# Phase 4 — Music Provider Abstraction (Spotify + YouTube)

**Owner:** Agent B, parallel to Phase 2. **Depends on:** nothing (can build/test against a hardcoded `EmotionState` before Phase 3 exists). **Feeds:** Phase 5 (UI shows current track/provider), consumes Phase 3's `EmotionState`.

## Scope

One trait, two implementations, plus the shared local valence/energy reference dataset that both draw candidate tracks from.

## The trait

```rust
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

pub struct Track {
    pub title: String,
    pub artist: String,
    pub provider_id: String,   // Spotify URI or YouTube video ID
    pub valence: f32,
    pub energy: f32,
}
```

Both `SpotifyProvider` and `YouTubeProvider` implement this. The inference/selection logic (which reads `EmotionState` and picks a target point) never touches provider-specific code.

## Shared reference dataset (platform-agnostic)

Download the Kaggle "Spotify Tracks Dataset" (pre-deprecation scrape, has `valence`, `energy`, `tempo`, `danceability`, `track_name`, `artists` columns) and load it into a local SQLite table:

```sql
CREATE TABLE track_reference (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    valence REAL NOT NULL,
    energy REAL NOT NULL,
    tempo REAL,
    normalized_title TEXT,   -- lowercased, punctuation-stripped, for fuzzy matching
    normalized_artist TEXT
);
```

Match against the user's actual library (Liked Songs on either platform) by normalized title+artist. Nearest-neighbor search in (valence, energy) space against whatever subset of this table matches the user's library — this is the "AI-sounding" part that's actually just a k-NN lookup, which is fine, say so plainly in the report rather than dressing it up.

## Spotify implementation

- Auth: Authorization Code + PKCE (no client secret needed, appropriate for a desktop app).
- Fetch library: `GET /me/tracks` (paginated, still live).
- Match fetched tracks against `track_reference` by title+artist.
- Playback: `PUT /me/player/play` with `uris: [spotify:track:...]` — **requires Premium and an already-open Spotify session** on some device; surface this clearly in the UI if it fails (don't fail silently).
- Do **not** attempt `recommendations`, `audio-features`, or playlist-creation endpoints — dead for new apps, confirmed as of Feb 2026 changes.

## YouTube implementation

- Auth: OAuth 2.0 (Google), scopes for `youtube.readonly` at minimum.
- Fetch library: `playlistItems.list` with `playlistId=LL` (official "Liked Videos" playlist ID — works for YouTube Music likes too, same backend).
- Match fetched video titles against `track_reference` (title matching will be noisier here — video titles often have "(Official Audio)"/"(Lyrics)" suffixes, strip common patterns before normalizing).
- Playback: embed the official **YouTube IFrame Player API** inside the Tauri webview and load the target video ID directly — your app becomes the player, no external app dependency. This is the cleaner path vs. Spotify's remote-control model.
- **Quota discipline:** `search.list` costs 100 units/call against a 10,000/day default quota (~100 searches/day). Cache every search result locally in `track_reference` (or a separate `youtube_cache` table) keyed by normalized title+artist, and only call `search.list` on a genuine cache miss.

## Definition of done

- `MusicProvider` trait compiles against both implementations with no leaked provider-specific types in the shared interface.
- Spotify: library fetch, matching, and playback all work end-to-end against a real Premium account.
- YouTube: library fetch, matching, and IFrame playback work end-to-end; search cache confirmed to prevent redundant quota use.
- Both providers tested against the same hardcoded `EmotionState` values before Phase 3 is wired in, so this phase never blocks on Phase 3's completion.
