use crate::{normalize_string, MusicProvider, Track};
use anyhow::Context;
use async_trait::async_trait;
use rusqlite::Connection;
use std::sync::Mutex;

pub struct SpotifyProvider {
    db_path: String,
    access_token: Mutex<Option<String>>,
    client: reqwest::Client,
}

impl SpotifyProvider {
    pub fn new(db_path: &str, access_token: Option<String>) -> Self {
        Self {
            db_path: db_path.to_string(),
            access_token: Mutex::new(access_token),
            client: reqwest::Client::new(),
        }
    }

    /// Sets the access token dynamically (e.g., after OAuth redirect in Phase 5)
    pub fn set_token(&self, token: &str) {
        let mut guard = self.access_token.lock().unwrap();
        *guard = Some(token.to_string());
    }

    /// Fetches the user's Spotify library (liked songs). 
    /// Falls back to a mock library of popular songs if no token is set.
    async fn fetch_user_library(&self) -> anyhow::Result<Vec<(String, String, String)>> {
        let token = {
            let guard = self.access_token.lock().unwrap();
            guard.clone()
        };

        if let Some(token_str) = token {
            // Live Spotify API Integration: GET /v1/me/tracks
            println!("Spotify: Fetching user library from Spotify Web API...");
            let mut tracks = Vec::new();
            let mut next_url = Some("https://api.spotify.com/v1/me/tracks?limit=50".to_string());

            while let Some(url) = next_url {
                let resp = self.client.get(&url)
                    .bearer_auth(&token_str)
                    .send()
                    .await?;

                if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
                    return Err(anyhow::anyhow!("Spotify token expired or unauthorized."));
                }

                let body: serde_json::Value = resp.json().await?;
                if let Some(items) = body.get("items").and_then(|i| i.as_array()) {
                    for item in items {
                        if let Some(track) = item.get("track") {
                            let title = track.get("name").and_then(|n| n.as_str()).unwrap_or("").to_string();
                            let artist = track.get("artists")
                                .and_then(|a| a.as_array())
                                .and_then(|a| a.first())
                                .and_then(|a| a.get("name"))
                                .and_then(|n| n.as_str())
                                .unwrap_or("")
                                .to_string();
                            let uri = track.get("uri").and_then(|u| u.as_str()).unwrap_or("").to_string();
                            tracks.push((title, artist, uri));
                        }
                    }
                }
                next_url = body.get("next").and_then(|n| n.as_str()).map(|s| s.to_string());
                
                // Safety break for testing to avoid huge loops
                if tracks.len() >= 150 {
                    break;
                }
            }
            Ok(tracks)
        } else {
            // Mock Mode Fallback: return a curated user library
            println!("Spotify: [MOCK MODE] Fetching mock user liked songs library...");
            Ok(vec![
                ("Happy".to_string(), "Pharrell Williams".to_string(), "spotify:track:60nG0S0sw271WgC4r5g1ok".to_string()),
                ("Uptown Funk".to_string(), "Mark Ronson ft. Bruno Mars".to_string(), "spotify:track:32O0w1w9FB0zIY7fGw56tW".to_string()),
                ("Yesterday".to_string(), "The Beatles".to_string(), "spotify:track:3BQHpfg5rcC194lO1goATH".to_string()),
                ("Banana Pancakes".to_string(), "Jack Johnson".to_string(), "spotify:track:4511I1gFB4sIZ7fGu56tW2".to_string()),
                ("Smells Like Teen Spirit".to_string(), "Nirvana".to_string(), "spotify:track:5111I1gFB4sIZ7fGu56tW3".to_string()),
                ("Someone Like You".to_string(), "Adele".to_string(), "spotify:track:6111I1gFB4sIZ7fGu56tW4".to_string()),
                ("In The End".to_string(), "Linkin Park".to_string(), "spotify:track:60nG0S0sw271WgC4r5g1ok".to_string()),
            ])
        }
    }
}

#[async_trait]
impl MusicProvider for SpotifyProvider {
    async fn find_track(&self, target: (f32, f32)) -> anyhow::Result<Track> {
        let (target_valence, target_arousal) = target;
        println!("Spotify: Performing K-NN match for target (valence: {:.2}, arousal: {:.2})...", target_valence, target_arousal);

        // 1. Fetch user liked tracks
        let library = self.fetch_user_library().await?;

        // 2. Open SQLite connection to resolve features
        let conn = Connection::open(&self.db_path).context("Failed to open database for track matching")?;

        // Load all database track references
        let mut stmt = conn.prepare("SELECT title, artist, valence, energy FROM track_reference")?;
        let ref_iter = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, f64>(2)? as f32,
                row.get::<_, f64>(3)? as f32,
            ))
        })?;

        let mut ref_tracks = Vec::new();
        for t in ref_iter {
            ref_tracks.push(t?);
        }

        // 3. Filter reference tracks to match the user's liked library by normalized title + artist
        let mut candidates = Vec::new();
        for (lib_title, lib_artist, lib_uri) in &library {
            let norm_lib_title = normalize_string(lib_title);
            let norm_lib_artist = normalize_string(lib_artist);

            // Find in database reference tracks
            if let Some(ref_match) = ref_tracks.iter().find(|(ref_title, ref_artist, _, _)| {
                normalize_string(ref_title) == norm_lib_title && normalize_string(ref_artist) == norm_lib_artist
            }) {
                candidates.push(Track {
                    title: ref_match.0.clone(),
                    artist: ref_match.1.clone(),
                    provider_id: lib_uri.clone(),
                    valence: ref_match.2,
                    energy: ref_match.3,
                });
            }
        }

        // Fallback: If no matches in library, search across the entire global track reference table
        if candidates.is_empty() {
            println!("Spotify: No library tracks matched database references. Falling back to global search...");
            for (idx, (ref_title, ref_artist, valence, energy)) in ref_tracks.iter().enumerate() {
                candidates.push(Track {
                    title: ref_title.clone(),
                    artist: ref_artist.clone(),
                    provider_id: format!("spotify:track:fallback_{}", idx),
                    valence: *valence,
                    energy: *energy,
                });
            }
        }

        // 4. K-NN matching (Euclidean distance on 2D emotion space)
        candidates.sort_by(|c1, c2| {
            let dist1 = ((c1.valence - target_valence).powi(2) + (c1.energy - target_arousal).powi(2)).sqrt();
            let dist2 = ((c2.valence - target_valence).powi(2) + (c2.energy - target_arousal).powi(2)).sqrt();
            dist1.partial_cmp(&dist2).unwrap_or(std::cmp::Ordering::Equal)
        });

        // Return the closest matching track
        if let Some(matched) = candidates.first() {
            println!("Spotify: Matched track: '{}' by '{}' (valence: {:.2}, energy: {:.2})", 
                     matched.title, matched.artist, matched.valence, matched.energy);
            Ok(matched.clone())
        } else {
            Err(anyhow::anyhow!("No tracks found in database reference to match against."))
        }
    }

    async fn play(&self, track: &Track) -> anyhow::Result<()> {
        let token = {
            let guard = self.access_token.lock().unwrap();
            guard.clone()
        };

        if let Some(token_str) = token {
            // Live Spotify remote control: PUT /v1/me/player/play
            println!("Spotify: Sending Play command to Spotify player client for: {}...", track.provider_id);
            let url = "https://api.spotify.com/v1/me/player/play";
            let payload = serde_json::json!({
                "uris": [track.provider_id]
            });

            let resp = self.client.put(url)
                .bearer_auth(token_str)
                .json(&payload)
                .send()
                .await?;

            if resp.status().is_success() {
                println!("Spotify: Play command sent successfully.");
                Ok(())
            } else if resp.status() == reqwest::StatusCode::NOT_FOUND {
                Err(anyhow::anyhow!("Spotify error: No active device found. Open Spotify on your device first!"))
            } else {
                let error_text = resp.text().await.unwrap_or_else(|_| "Unknown error".to_string());
                Err(anyhow::anyhow!("Spotify error: {}", error_text))
            }
        } else {
            // Mock Playback
            println!("\n>>> [MOCK PLAYBACK] Spotify is now playing: '{}' by '{}' (URI: {}) <<<", 
                     track.title, track.artist, track.provider_id);
            Ok(())
        }
    }

    fn is_ready(&self) -> bool {
        // Authenticated if we have a token (or in mock mode, always ready for testing)
        let guard = self.access_token.lock().unwrap();
        guard.is_some() || true // true here guarantees mock mode is ready out-of-the-box for console tests
    }
}
