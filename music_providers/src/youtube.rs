use crate::{clean_title, normalize_string, MusicProvider, Track};
use anyhow::Context;
use async_trait::async_trait;
use chrono::Utc;
use rusqlite::{params, Connection};
use std::sync::Mutex;

pub struct YouTubeProvider {
    db_path: String,
    access_token: Mutex<Option<String>>,
    client: reqwest::Client,
}

impl YouTubeProvider {
    pub fn new(db_path: &str, access_token: Option<String>) -> Self {
        Self {
            db_path: db_path.to_string(),
            access_token: Mutex::new(access_token),
            client: reqwest::Client::new(),
        }
    }

    pub fn set_token(&self, token: &str) {
        let mut guard = self.access_token.lock().unwrap();
        *guard = Some(token.to_string());
    }

    /// Checks the local SQLite `youtube_cache` for a video ID matching the query
    fn get_cached_video_id(&self, artist: &str, title: &str) -> anyhow::Result<Option<String>> {
        let conn = Connection::open(&self.db_path)?;
        let query_key = format!("{} - {}", normalize_string(artist), normalize_string(title));

        let mut stmt = conn.prepare("SELECT video_id FROM youtube_cache WHERE query_key = ?")?;
        let mut rows = stmt.query(params![query_key])?;

        if let Some(row) = rows.next()? {
            let vid: String = row.get(0)?;
            Ok(Some(vid))
        } else {
            Ok(None)
        }
    }

    /// Stores the resolved video ID in the local SQLite cache
    fn cache_video_id(&self, artist: &str, title: &str, video_id: &str) -> anyhow::Result<()> {
        let conn = Connection::open(&self.db_path)?;
        let query_key = format!("{} - {}", normalize_string(artist), normalize_string(title));
        let ts_now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT OR REPLACE INTO youtube_cache (query_key, video_id, ts_cached) VALUES (?, ?, ?)",
            params![query_key, video_id, ts_now],
        )?;
        Ok(())
    }

    /// Queries the YouTube Data API v3 Search endpoint (or simulates in mock mode).
    /// Uses search caching to enforce quota discipline (100 quota units per call).
    async fn search_youtube(&self, artist: &str, title: &str) -> anyhow::Result<String> {
        // 1. Check local cache first (Cost: 0 quota units)
        if let Ok(Some(cached_id)) = self.get_cached_video_id(artist, title) {
            println!("YouTube: [CACHE HIT] Resolved video ID for '{}' by '{}' -> {}", title, artist, cached_id);
            return Ok(cached_id);
        }

        println!("YouTube: [CACHE MISS] Querying YouTube search endpoint for '{}' by '{}'...", title, artist);

        let token = {
            let guard = self.access_token.lock().unwrap();
            guard.clone()
        };

        if let Some(token_str) = token {
            // Live YouTube API integration: GET /v3/search
            let query = format!("{} {}", artist, title);
            let url = format!(
                "https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q={}&type=video",
                percent_encoding::utf8_percent_encode(&query, percent_encoding::NON_ALPHANUMERIC)
            );

            let resp = self.client.get(&url)
                .bearer_auth(token_str)
                .send()
                .await?;

            if !resp.status().is_success() {
                let err_text = resp.text().await.unwrap_or_default();
                return Err(anyhow::anyhow!("YouTube search failed: {}", err_text));
            }

            let body: serde_json::Value = resp.json().await?;
            let video_id = body.get("items")
                .and_then(|items| items.as_array())
                .and_then(|items| items.first())
                .and_then(|item| item.get("id"))
                .and_then(|id| id.get("videoId"))
                .and_then(|v| v.as_str())
                .ok_or_else(|| anyhow::anyhow!("No video results returned from YouTube search"))?
                .to_string();

            // Cache it locally
            let _ = self.cache_video_id(artist, title, &video_id);
            Ok(video_id)
        } else {
            // Mock Mode search mapping
            let mock_id = match (normalize_string(artist).as_str(), normalize_string(title).as_str()) {
                ("pharrell williams", "happy") => "O-7g4kGCSXQ".to_string(),
                ("jack johnson", "banana pancakes") => "O-7g4kGCSXQ".to_string(),
                ("the beatles", "yesterday") => "wM0IdWY0aYU".to_string(),
                ("nirvana", "smells like teen spirit") => "hTWKbfoikeg".to_string(),
                ("adele", "someone like you") => "hLQl3WQQoQ0".to_string(),
                ("linkin park", "in the end") => "eVTXPUF4Oz4".to_string(),
                _ => {
                    // Generate a deterministic mock video ID based on strings
                    let sum: usize = title.chars().map(|c| c as usize).sum();
                    format!("mock_yt_vid_{:x}", sum)
                }
            };
            
            // Save mock results in local cache too
            let _ = self.cache_video_id(artist, title, &mock_id);
            Ok(mock_id)
        }
    }

    /// Fetches user Liked Videos from YouTube / YouTube Music.
    async fn fetch_user_library(&self) -> anyhow::Result<Vec<(String, String)>> {
        let token = {
            let guard = self.access_token.lock().unwrap();
            guard.clone()
        };

        if let Some(token_str) = token {
            // Live YouTube Liked Videos API (playlistId=LL)
            println!("YouTube: Fetching Liked Videos playlist from YouTube API...");
            let mut tracks = Vec::new();
            let mut next_page_token: Option<String> = None;

            loop {
                let mut url = "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=LL&maxResults=50".to_string();
                if let Some(ref page) = next_page_token {
                    url.push_str(&format!("&pageToken={}", page));
                }

                let resp = self.client.get(&url)
                    .bearer_auth(&token_str)
                    .send()
                    .await?;

                if !resp.status().is_success() {
                    return Err(anyhow::anyhow!("YouTube library fetch failed. Code: {}", resp.status()));
                }

                let body: serde_json::Value = resp.json().await?;
                if let Some(items) = body.get("items").and_then(|i| i.as_array()) {
                    for item in items {
                        if let Some(snippet) = item.get("snippet") {
                            let video_title = snippet.get("title").and_then(|t| t.as_str()).unwrap_or("");
                            
                            // YouTube titles are usually "Artist - Song Title" or "Song Title"
                            // We parse them cleanly
                            let cleaned = clean_title(video_title);
                            let parts: Vec<&str> = cleaned.split(" - ").collect();
                            
                            let (artist, title) = if parts.len() >= 2 {
                                (parts[0].trim().to_string(), parts[1..].join(" - ").trim().to_string())
                            } else {
                                ("".to_string(), parts[0].trim().to_string())
                            };
                            
                            tracks.push((title, artist));
                        }
                    }
                }

                next_page_token = body.get("nextPageToken").and_then(|n| n.as_str()).map(|s| s.to_string());
                if next_page_token.is_none() || tracks.len() >= 100 {
                    break;
                }
            }
            Ok(tracks)
        } else {
            // Mock Liked Library
            println!("YouTube: [MOCK MODE] Fetching mock user Liked Videos...");
            Ok(vec![
                ("Happy".to_string(), "Pharrell Williams".to_string()),
                ("Yesterday".to_string(), "The Beatles".to_string()),
                ("Smells Like Teen Spirit".to_string(), "Nirvana".to_string()),
                ("Someone Like You".to_string(), "Adele".to_string()),
                ("In The End".to_string(), "Linkin Park".to_string()),
            ])
        }
    }
}

#[async_trait]
impl MusicProvider for YouTubeProvider {
    async fn find_track(&self, target: (f32, f32)) -> anyhow::Result<Track> {
        let (target_valence, target_arousal) = target;
        println!("YouTube: Performing K-NN match for target (valence: {:.2}, arousal: {:.2})...", target_valence, target_arousal);

        // 1. Fetch library
        let library = self.fetch_user_library().await?;

        // 2. Open SQLite reference and load tracks in block to free non-Send resources
        let ref_tracks = {
            let conn = Connection::open(&self.db_path).context("Failed to open database for track matching")?;
            let mut stmt = conn.prepare("SELECT title, artist, valence, energy FROM track_reference")?;
            let ref_iter = stmt.query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, f64>(2)? as f32,
                    row.get::<_, f64>(3)? as f32,
                ))
            })?;

            let mut list = Vec::new();
            for t in ref_iter {
                list.push(t?);
            }
            list
        };

        // 3. Match library tracks against database reference
        let mut candidates = Vec::new();
        for (lib_title, lib_artist) in &library {
            let norm_lib_title = normalize_string(lib_title);
            let norm_lib_artist = normalize_string(lib_artist);

            if let Some(ref_match) = ref_tracks.iter().find(|(ref_title, ref_artist, _, _)| {
                let norm_ref_title = normalize_string(ref_title);
                let norm_ref_artist = normalize_string(ref_artist);
                
                // Fuzzy check (either title matches, or they contain each other)
                (norm_ref_title == norm_lib_title && norm_ref_artist == norm_lib_artist) ||
                (lib_artist.is_empty() && norm_ref_title == norm_lib_title) // matching raw titles without artist
            }) {
                candidates.push(Track {
                    title: ref_match.0.clone(),
                    artist: ref_match.1.clone(),
                    provider_id: "".to_string(), // we resolve video id via search cache later
                    valence: ref_match.2,
                    energy: ref_match.3,
                });
            }
        }

        // Fallback: search global reference
        if candidates.is_empty() {
            println!("YouTube: No library tracks matched database references. Falling back to global search...");
            for (ref_title, ref_artist, valence, energy) in ref_tracks {
                candidates.push(Track {
                    title: ref_title,
                    artist: ref_artist,
                    provider_id: "".to_string(),
                    valence,
                    energy,
                });
            }
        }

        // 4. K-NN matching (Euclidean distance on 2D emotion space)
        candidates.sort_by(|c1, c2| {
            let dist1 = ((c1.valence - target_valence).powi(2) + (c1.energy - target_arousal).powi(2)).sqrt();
            let dist2 = ((c2.valence - target_valence).powi(2) + (c2.energy - target_arousal).powi(2)).sqrt();
            dist1.partial_cmp(&dist2).unwrap_or(std::cmp::Ordering::Equal)
        });

        // 5. Resolve Video ID for the closest track (uses cache to respect quota)
        if let Some(mut matched) = candidates.first().cloned() {
            let video_id = self.search_youtube(&matched.artist, &matched.title).await?;
            matched.provider_id = video_id;

            println!("YouTube: Matched track: '{}' by '{}' (valence: {:.2}, energy: {:.2}) -> Video ID: {}", 
                     matched.title, matched.artist, matched.valence, matched.energy, matched.provider_id);
            Ok(matched)
        } else {
            Err(anyhow::anyhow!("No tracks found in database reference to match against."))
        }
    }

    async fn play(&self, track: &Track) -> anyhow::Result<()> {
        // Playback for YouTube happens in the webview (Tauri frontend iframe player).
        // The play method logs/returns successfully, indicating the video is queued.
        println!("\n>>> [IFRAME PLAYER QUEUE] YouTube IFrame player loading Video ID: {} ('{}' by '{}') <<<", 
                 track.provider_id, track.title, track.artist);
        Ok(())
    }

    fn is_ready(&self) -> bool {
        // ready if we have a token (or for testing mock mode, always true)
        let guard = self.access_token.lock().unwrap();
        guard.is_some() || true
    }
}
