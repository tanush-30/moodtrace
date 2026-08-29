pub mod spotify;
pub mod youtube;

use rusqlite::{params, Connection};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Track {
    pub title: String,
    pub artist: String,
    pub provider_id: String,   // Spotify URI or YouTube video ID
    pub valence: f32,
    pub energy: f32,
}

#[async_trait::async_trait]
pub trait MusicProvider {
    /// Find a playable track matching a target (valence, arousal) point,
    /// searching within the user's own library/liked tracks first.
    async fn find_track(&self, target: (f32, f32)) -> anyhow::Result<Track>;

    /// Start playback of a specific track.
    async fn play(&self, track: &Track) -> anyhow::Result<()>;

    /// Whether this provider is currently authenticated/ready.
    fn is_ready(&self) -> bool;
}

/// Normalizes titles and artists for fuzzy/case-insensitive matching
pub fn normalize_string(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ")
}

/// Cleans YouTube titles from common video/audio suffixes
pub fn clean_title(title: &str) -> String {
    let t = title.to_lowercase();
    let clean_targets = [
        "(official video)",
        "[official video]",
        "(official audio)",
        "[official audio]",
        "(lyrics)",
        "[lyrics]",
        "(official)",
        "[official]",
        "(audio)",
        "[audio]",
        "(lyric video)",
        "[lyric video]",
    ];
    let mut cleaned = t;
    for target in &clean_targets {
        cleaned = cleaned.replace(target, "");
    }
    cleaned.trim().to_string()
}

/// Initializes database tables and populates the `track_reference` table if empty
pub fn init_track_database(conn: &Connection) -> anyhow::Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS track_reference (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            artist TEXT NOT NULL,
            valence REAL NOT NULL,
            energy REAL NOT NULL,
            tempo REAL,
            normalized_title TEXT NOT NULL,
            normalized_artist TEXT NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS youtube_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            query_key TEXT UNIQUE NOT NULL,
            video_id TEXT NOT NULL,
            ts_cached TEXT NOT NULL
        )",
        [],
    )?;

    // Check if the table is already populated
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM track_reference",
        [],
        |row| row.get(0),
    )?;

    if count == 0 {
        println!("Populating reference track dataset (100 popular tracks)...");
        
        // Curated dataset of popular songs across all emotional quadrants
        // Format: (title, artist, valence, energy/arousal, tempo)
        let dataset = vec![
            // --- Happy/Upbeat (High Valence, High Energy) ---
            ("Happy", "Pharrell Williams", 0.962, 0.817, 160.0),
            ("Uptown Funk", "Mark Ronson ft. Bruno Mars", 0.928, 0.609, 115.0),
            ("Can't Stop the Feeling!", "Justin Timberlake", 0.702, 0.833, 113.0),
            ("Shake It Off", "Taylor Swift", 0.943, 0.791, 160.0),
            ("Don't Stop Me Now", "Queen", 0.709, 0.867, 156.0),
            ("Shut Up and Dance", "WALK THE MOON", 0.619, 0.966, 128.0),
            ("I Wanna Dance with Somebody", "Whitney Houston", 0.871, 0.822, 119.0),
            ("Dynamite", "BTS", 0.737, 0.765, 114.0),
            ("Hey Ya!", "Outkast", 0.966, 0.974, 136.0),
            ("Walking on Sunshine", "Katrina and the Waves", 0.944, 0.884, 110.0),
            ("Valerie", "Mark Ronson ft. Amy Winehouse", 0.887, 0.785, 105.0),
            ("Sugar", "Maroon 5", 0.881, 0.788, 120.0),
            ("Dancing Queen", "ABBA", 0.707, 0.879, 100.0),
            ("Levels", "Avicii", 0.463, 0.887, 126.0),
            ("Wake Me Up", "Avicii", 0.640, 0.784, 124.0),
            ("Good as Hell", "Lizzo", 0.815, 0.886, 96.0),
            ("Rather Be", "Clean Bandit", 0.863, 0.596, 121.0),
            ("High Hopes", "Panic! At The Disco", 0.657, 0.904, 82.0),
            ("On Top Of The World", "Imagine Dragons", 0.755, 0.920, 100.0),
            ("Feel So Close", "Calvin Harris", 0.932, 0.921, 128.0),
            ("Best Day Of My Life", "American Authors", 0.825, 0.902, 120.0),
            ("September", "Earth, Wind & Fire", 0.982, 0.781, 125.0),
            ("Mamma Mia", "ABBA", 0.831, 0.748, 137.0),
            ("All Star", "Smash Mouth", 0.782, 0.865, 104.0),
            ("Party Rock Anthem", "LMFAO", 0.584, 0.912, 130.0),

            // --- Aggressive/Tense/Energetic (Low Valence, High Energy) ---
            ("Smells Like Teen Spirit", "Nirvana", 0.286, 0.912, 117.0),
            ("In The End", "Linkin Park", 0.400, 0.864, 105.0),
            ("Kryptonite", "3 Doors Down", 0.543, 0.865, 99.0),
            ("Believer", "Imagine Dragons", 0.666, 0.780, 125.0),
            ("Numb", "Linkin Park", 0.244, 0.863, 110.0),
            ("Chop Suey!", "System of a Down", 0.283, 0.934, 127.0),
            ("Killing In The Name", "Rage Against The Machine", 0.384, 0.967, 88.0),
            ("Seven Nation Army", "The White Stripes", 0.302, 0.463, 120.0),
            ("Stronger", "Kanye West", 0.490, 0.717, 104.0),
            ("Lose Yourself", "Eminem", 0.244, 0.744, 86.0),
            ("Radioactive", "Imagine Dragons", 0.210, 0.777, 136.0),
            ("Uprising", "Muse", 0.468, 0.920, 128.0),
            ("Pretender", "Foo Fighters", 0.365, 0.959, 135.0),
            ("Back In Black", "AC/DC", 0.763, 0.897, 91.0),
            ("Harder, Better, Faster, Stronger", "Daft Punk", 0.654, 0.729, 123.0),
            ("Misery Business", "Paramore", 0.729, 0.964, 173.0),
            ("Bodies", "Drowning Pool", 0.360, 0.967, 150.0),
            ("Bulls On Parade", "Rage Against The Machine", 0.485, 0.899, 90.0),
            ("Rope", "Foo Fighters", 0.463, 0.887, 134.0),
            ("Enter Sandman", "Metallica", 0.612, 0.835, 123.0),
            ("Welcome to the Jungle", "Guns N' Roses", 0.329, 0.950, 123.0),
            ("Psychosocial", "Slipknot", 0.180, 0.988, 135.0),
            ("Smooth Criminal", "Alien Ant Farm", 0.412, 0.970, 127.0),
            ("Break Stuff", "Limp Bizkit", 0.380, 0.920, 110.0),
            ("Through The Fire And Flames", "DragonForce", 0.155, 0.989, 200.0),

            // --- Calm/Relaxed/Mellow (High Valence, Low Energy) ---
            ("Banana Pancakes", "Jack Johnson", 0.835, 0.279, 120.0),
            ("Landslide", "Fleetwood Mac", 0.438, 0.179, 159.0),
            ("Put Your Records On", "Corinne Bailey Rae", 0.546, 0.537, 96.0),
            ("Sunrise", "Norah Jones", 0.681, 0.301, 157.0),
            ("Come Away With Me", "Norah Jones", 0.316, 0.160, 80.0),
            ("Better Together", "Jack Johnson", 0.743, 0.301, 110.0),
            ("Bubbly", "Colbie Caillat", 0.540, 0.352, 120.0),
            ("I'm Yours", "Jason Mraz", 0.718, 0.444, 151.0),
            ("Three Little Birds", "Bob Marley", 0.785, 0.395, 75.0),
            ("Sunday Morning", "Maroon 5", 0.720, 0.550, 88.0),
            ("Beyond", "Leon Bridges", 0.590, 0.420, 112.0),
            ("Gravity", "John Mayer", 0.347, 0.287, 78.0),
            ("Budapest", "George Ezra", 0.411, 0.444, 128.0),
            ("Lucky", "Jason Mraz & Colbie Caillat", 0.690, 0.410, 130.0),
            ("Thinking Out Loud", "Ed Sheeran", 0.591, 0.445, 79.0),
            ("Georgia", "Vance Joy", 0.345, 0.210, 94.0),
            ("Lego House", "Ed Sheeran", 0.640, 0.530, 80.0),
            ("Our House", "Crosby, Stills, Nash & Young", 0.780, 0.450, 120.0),
            ("What a Wonderful World", "Louis Armstrong", 0.490, 0.150, 78.0),
            ("Lovely Day", "Bill Withers", 0.750, 0.520, 98.0),
            ("Ho Hey", "The Lumineers", 0.812, 0.420, 110.0),
            ("Simple Man", "Lynyrd Skynyrd", 0.530, 0.540, 120.0),
            ("More Than Words", "Extreme", 0.485, 0.130, 92.0),
            ("Skinny Love", "Bon Iver", 0.380, 0.290, 77.0),
            ("Flightless Bird, American Mouth", "Iron & Wine", 0.460, 0.320, 120.0),

            // --- Sad/Melancholy/Slow (Low Valence, Low Energy) ---
            ("Someone Like You", "Adele", 0.285, 0.330, 135.0),
            ("Yesterday", "The Beatles", 0.396, 0.179, 97.0),
            ("Hurt", "Johnny Cash", 0.205, 0.273, 90.0),
            ("Fix You", "Coldplay", 0.119, 0.418, 138.0),
            ("Say Something", "A Great Big World ft. Christina Aguilera", 0.076, 0.147, 96.0),
            ("All I Want", "Kodaline", 0.143, 0.390, 85.0),
            ("Tears in Heaven", "Eric Clapton", 0.431, 0.288, 77.0),
            ("Creep", "Radiohead", 0.104, 0.342, 92.0),
            ("Let Her Go", "Passenger", 0.244, 0.538, 75.0),
            ("The Scientist", "Coldplay", 0.165, 0.437, 146.0),
            ("When The Party's Over", "Billie Eilish", 0.082, 0.110, 83.0),
            ("Stay With Me", "Sam Smith", 0.201, 0.420, 84.0),
            ("Skinny Love", "Birdy", 0.155, 0.280, 168.0),
            ("Supermarket Flowers", "Ed Sheeran", 0.210, 0.240, 90.0),
            ("Breakeven", "The Script", 0.490, 0.520, 94.0),
            ("Another Love", "Tom Odell", 0.131, 0.538, 122.0),
            ("Mad World", "Gary Jules", 0.301, 0.110, 80.0),
            ("Chasing Cars", "Snow Patrol", 0.220, 0.470, 104.0),
            ("Everybody Hurts", "R.E.M.", 0.280, 0.320, 94.0),
            ("Nothing Compares 2 U", "Sinead O'Connor", 0.160, 0.320, 120.0),
            ("Back To Black", "Amy Winehouse", 0.280, 0.580, 120.0),
            ("I Lose Me", "OneRepublic", 0.410, 0.510, 110.0),
            ("Photograph", "Ed Sheeran", 0.200, 0.380, 108.0),
            ("Hallelujah", "Jeff Buckley", 0.090, 0.140, 78.0),
            ("Snuff", "Slipknot", 0.210, 0.420, 112.0),
        ];

        // Bulk insert Reference Dataset in a single transaction
        let mut stmt = conn.prepare(
            "INSERT INTO track_reference (title, artist, valence, energy, tempo, normalized_title, normalized_artist) 
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        )?;

        for (title, artist, valence, energy, tempo) in dataset {
            let n_title = normalize_string(title);
            let n_artist = normalize_string(artist);
            stmt.execute(params![title, artist, valence, energy, tempo, n_title, n_artist])?;
        }

        println!("Populated track reference database with 100 tracks successfully.");
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_string() {
        assert_eq!(normalize_string("Smells Like Teen Spirit!"), "smells like teen spirit");
        assert_eq!(normalize_string("  Uptown   Funk...  "), "uptown funk");
        assert_eq!(normalize_string("Rock & Roll"), "rock roll");
    }

    #[test]
    fn test_clean_title() {
        assert_eq!(clean_title("Nirvana - Smells Like Teen Spirit (Official Video)"), "nirvana - smells like teen spirit");
        assert_eq!(clean_title("Coldplay - Fix You [Official Audio]"), "coldplay - fix you");
        assert_eq!(clean_title("Someone Like You (Lyrics)"), "someone like you");
    }
}
