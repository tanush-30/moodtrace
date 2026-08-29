use music_providers::spotify::SpotifyProvider;
use music_providers::youtube::YouTubeProvider;
use music_providers::{init_track_database, MusicProvider};
use rusqlite::Connection;
use std::path::Path;

fn get_db_path() -> String {
    // Resolve relative path to moodtrace.db in parent or current directory
    let paths = ["../moodtrace.db", "moodtrace.db"];
    for path in &paths {
        if Path::new(path).exists() {
            return path.to_string();
        }
    }
    "moodtrace.db".to_string()
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let db_path = get_db_path();
    println!("Database Path resolved to: {}", db_path);

    // 1. Initialize SQLite Database track references
    {
        let conn = Connection::open(&db_path)?;
        init_track_database(&conn)?;
    }

    // 2. Initialize Providers (in mock mode for testing)
    let spotify = SpotifyProvider::new(&db_path, None);
    let youtube = YouTubeProvider::new(&db_path, None);

    // 3. Define target emotional state coordinates (valence, arousal)
    // Range is -1.0 to 1.0 on both axes
    let test_scenarios = vec![
        ("High Arousal, Low Valence (Stressed / Tense)", (-0.6, 0.7)),
        ("High Arousal, High Valence (Excited / Energetic)", (0.7, 0.8)),
        ("Low Arousal, High Valence (Calm / Relaxed)", (0.6, -0.5)),
        ("Low Arousal, Low Valence (Sad / Melancholic)", (-0.5, -0.6)),
    ];

    println!("\n==================================================");
    println!("Running Music Provider K-NN Match Simulations");
    println!("==================================================");

    for (name, target) in test_scenarios {
        println!("\n>>> Scenario: {}", name);
        println!(">>> Target (valence: {:.2}, arousal: {:.2})", target.0, target.1);

        // --- Test Spotify matching and playback ---
        println!("\nTesting Spotify Provider:");
        match spotify.find_track(target).await {
            Ok(track) => {
                println!("  Selected Track: '{}' by '{}'", track.title, track.artist);
                println!("  Valence: {:.3}, Energy: {:.3}", track.valence, track.energy);
                // Trigger play
                let _ = spotify.play(&track).await;
            }
            Err(e) => eprintln!("  Spotify Match Error: {:?}", e),
        }

        // --- Test YouTube matching and playback ---
        println!("\nTesting YouTube Provider:");
        match youtube.find_track(target).await {
            Ok(track) => {
                println!("  Selected Video: '{}' by '{}'", track.title, track.artist);
                println!("  Valence: {:.3}, Energy: {:.3}", track.valence, track.energy);
                // Trigger play
                let _ = youtube.play(&track).await;
            }
            Err(e) => eprintln!("  YouTube Match Error: {:?}", e),
        }
        
        println!("--------------------------------------------------");
    }

    Ok(())
}
