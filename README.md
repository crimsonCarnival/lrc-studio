# LRC Studio
 
A professional web application for synchronizing song lyrics with audio, with support for karaoke-style word-level timing, multi-language content, cloud projects, and more.
 
**[lrc-studio.vercel.app](https://lrc-studio.vercel.app)** · [GitHub](https://github.com/crimsonCarnival/lrc-studio) · [Documentation (DeepWiki)](https://deepwiki.com/crimsonCarnival/lrc-studio)

> Translations: [Español (Spanish)](docs/translations/README.es.md) • [日本語 (Japanese)](docs/translations/README.ja.md)

## Table of Contents

- [Features](#features)
  - [Audio Sources](#-audio-sources)
  - [Editor Modes](#editor-modes)
  - [Timing & Synchronization](#timing--synchronization)
  - [Lyric Content](#lyric-content)
  - [Import](#import)
  - [Export](#export)
  - [Live Preview](#live-preview)
  - [Project Management](#project-management)
  - [Sharing](#sharing)
  - [Keyboard Shortcuts](#️-keyboard-shortcuts)
  - [Interface & Themes](#interface--themes)
  - [Settings Panels](#settings-panels)
  - [Authentication](#authentication)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Available Scripts](#available-scripts)
- [Docker Deployment Considerations](#docker-deployment-considerations)
- [LRC File Format Reference](#lrc-file-format-reference)
  - [Standard LRC](#standard-lrc)
  - [Enhanced LRC (Word-level)](#enhanced-lrc-word-level)
  - [With Secondary / Furigana](#with-secondary--furigana)
- [License](#license)

## Features

### 🎵 Audio Sources

- **Local Files** — Drag and drop or browse to load MP3, WAV, FLAC, OGG, and other common formats. Full waveform display with seek and loop handles.
- **YouTube** — Paste any YouTube URL to stream the audio directly inside the editor. Includes a visual playback progress indicator with A-B loop support.
- **Spotify** — Connect your Spotify Premium account via OAuth to load and play tracks from Spotify's catalog directly in the editor.

### Editor Modes

- **LRC Mode** — Line-by-line synchronization with millisecond-accurate timestamps. Hit a configurable key (default: `Space`) to stamp the current playback position onto the active line.
- **SRT Mode** — Subtitle format with start and end times per line. Each line gets both an in and out timestamp for precise subtitle placement.
- **Words Mode** — Per-word karaoke synchronization. Each word in a line gets its own independent timestamp, enabling animated karaoke-fill playback in the preview.

### Timing & Synchronization

- **Keyboard-driven stamping** — Fully configurable shortcut keys for marking, nudging, and navigating lines during sync sessions.
- **Fine nudging** — Shift timestamps forward or backward by configurable increments (default: 0.1s / 0.01s fine).
- **Bulk shift** — Select multiple lines and shift their timestamps simultaneously.
- **Global offset** — Shift all timestamps at once.
- **A-B loop** — Set loop start and end points on the waveform or progress bar to practice a section repeatedly.
- **Auto-pause on mark** — Optionally pause playback automatically after stamping a line.
- **Overlapping timestamp detection** — Visual badge warns when two lines share the same timestamp.

### Lyric Content

- **Secondary lyrics** — Add a secondary text track per line (e.g., romaji, alternate language pronunciation).
- **Translation layer** — A separate per-line translation field (e.g., English translation alongside Japanese lyrics).
- **Furigana / Ruby markup** — Annotate CJK characters with readings using `{字|じ}` syntax. The editor renders ruby markup above the character inline.
- **CJK-aware tokenization** — Japanese, Chinese, and Korean text is automatically split character-by-character for per-character timing; Latin runs are kept as whole-word tokens.
- **Reading format** — Toggle between Hiragana and Katakana for phonetic reading display.
- **Dual-line display** — Optionally show the next line below the active line during sync for better readability.

### Import

- **Paste / Type** — Enter lyrics directly in the editor's text input.
- **File import** — Load existing `.lrc`, `.srt`, or `.txt` files. Word-level LRC (Enhanced LRC) is also supported and preserves per-word timestamps.
- **URL import** — Import lyrics from a remote URL via the import panel.
- **Paste detection** — Pasting an LRC or SRT block into the editor is automatically detected and parsed.
- **Genius Search & Extraction** — Search for songs on Genius.com directly from the setup wizard or the editor toolbar, preview the lyrics, and import them instantly as unsynced lines.

### Export

- **LRC download** — Standard `[MM:SS.xx]` format with optional word timestamps (`<MM:SS.xx>`).
- **SRT download** — `HH:MM:SS,ms --> HH:MM:SS,ms` format with optional second-line secondary content.
- **Copy to clipboard** — Instantly copy the compiled LRC or SRT output.
- **LRC metadata tags** — Optionally include `[ti:]`, `[ar:]`, `[al:]`, `[lg:]` header tags.
- **Configurable precision** — Choose hundredths (`[01:23.45]`) or thousandths (`[01:23.456]`) precision for both line and word timestamps.
- **Line endings** — Select LF or CRLF for compatibility with different media players.
- **Strip empty lines** — Automatically omit unsynced or blank lines from the output.
- **Normalize timestamps** — Sort and deduplicate timestamps on export.
- **Filename pattern** — Export file named `lyrics.lrc` (fixed) or derived from the project title (media-based).
- **Translation & secondary toggles** — Choose whether to include the secondary track and/or translations in the exported file.
- **Server compilation with local fallback** — Export compiles on the server for advanced formatting; automatically falls back to the local compiler if the server is unavailable.

### Live Preview

- **Real-time karaoke preview** — The preview panel highlights the currently playing line and fills words character-by-character as they play (in Words mode).
- **Karaoke fill easing** — Choose between linear (accurate) and ease-in/out (smooth) word fill animation.
- **Fill track selection** — Apply the animated fill to the main text, secondary text, or both.
- **Translation display** — Optionally show the translation layer below each lyric line in the preview.
- **Furigana display** — Toggle ruby text annotations visible in the preview.
- **Font size** — Four size presets: Small, Normal, Large, X-Large.
- **Line spacing** — Compact, Normal, or Relaxed spacing between lines.
- **Preview alignment** — Left, center, or right alignment.
- **Auto-scroll** — Automatically scrolls the active line into view; configurable alignment (center, top, nearest, off) and scroll behavior (smooth / instant).

### Project Management

- **Project library** — Browse, search, and manage all your projects. Each project stores lyrics, timestamps, media references, and editor state.
- **Cloud sync** — Authenticated users have projects saved to the server automatically. Projects are created on first save and patched incrementally for efficiency.
- **Guest Mode & Project Claiming** — Edit and work on projects without creating an account. When ready to save, pre-create the project and securely migrate it to your account seamlessly upon signing in via a one-time secure claim token.
- **Autosave** — Dual-condition autosave fires after a configurable time interval or after 5 line edits, whichever comes first.
- **Manual save** — Save button with autosave status indicator (spinner → checkmark).
- **Local storage fallback** — All project data is also mirrored to `localStorage` so work is never lost offline.
- **Uploads library** — View all audio files and YouTube/Spotify tracks previously associated with projects.
- **Shared project viewer** — Open a read-only view of a shared project with its embedded media and synced lyrics.
- **Project metadata** — Store a project name, description, and tags.

### Sharing

- **Public/private sharing** — Generate a shareable URL for any project. Toggle between public (anyone with link) and private (owner only) visibility.
- **Deep link with timestamp** — Include a `?s=N` query param in the share URL to start playback at a specific second.
- **Current position shortcut** — One-click sync of the share timestamp to the current playback position.

### ⌨️ Keyboard Shortcuts

All shortcuts are fully user-configurable via **Settings → Shortcuts**.

| Action | Default Shortcut |
|---|---|
| **Editor Shortcuts** | |
| Stamp / Mark | `Space` |
| Nudge Left (subtract time) | `Alt+ArrowLeft` |
| Nudge Right (add time) | `Alt+ArrowRight` |
| Add Line | `Ctrl+Enter` |
| Delete Line | `Delete` |
| Clear Timestamp | `Backspace` |
| Switch Mode (LRC/SRT) | `Ctrl+M` |
| Deselect / Close | `Escape` |
| Show Shortcuts Help | `?` |
| Select a Range | `Shift + Click` |
| Pick Individual Lines | `Ctrl + Click` |
| **Player Shortcuts** | |
| Play / Pause | `Enter` |
| Seek Backward | `ArrowLeft` |
| Seek Forward | `ArrowRight` |
| Mute / Unmute | `m` |
| Speed Up | `+` |
| Speed Down | `-` |
| **Preview Shortcuts** | |
| Toggle Translations | `t` |
| Add Secondary Lyrics | `Shift+H` |
| Add Translations | `Shift+T` |

### Interface & Themes

- **Themes** — Dark, Light, Dracula, Alucard, Alucard Light, System (follows OS preference).
- **Active line highlight styles** — Glow, Zoom, Color, or Dim.
- **Translation layout** — Stacked (translation below lyric) or Side-by-side.
- **Focus mode** — Hides the editor panel for an unobstructed preview.
- **Resizable panels** — Drag the divider between editor and preview to adjust widths.
- **Lock layout** — Prevent accidental panel resizing.
- **Mobile layout** — Tabbed mobile navigation between player, editor, and preview panels.
- **Internationalization** — Full UI available in **English** and **Spanish** (more can be added via the `/locales` folder).

### Settings Panels

The application is highly customizable via the Settings modal. Settings are grouped into logical panels:

**Editor**
- **Default Editor Mode**: LRC or SRT.
- **Show Word Timestamps**: Toggle word-level `<MM:SS.xx>` timestamp visibility in the editor.
- **Auto-select Next Line**: Automatically advance selection after stamping.
- **Highlight Mode**: Controls how the active line is highlighted.
- **Loop Selection**: Automatically loop the audio bound by the selected lines.
- **Pause on Mark**: Pause playback immediately after stamping a line.
- **Shift Settings**: Configure the amount of time applied per "Shift All" action, and set the default nudge amount (e.g., 0.1s).

**Playback**
- **Seek Time**: Amount of seconds to skip forward/backward when seeking (default 5s).
- **Default Speed**: Set playback speed multipliers (0.5× to 1.5×, or custom).
- **Volume control**: Persistent volume slider with mute toggle.

**Interface**
- **Theme**: Dark, Light, Dracula, Alucard, Alucard Light, or System.
- **Language**: English or Spanish.
- **Active Line Highlight**: Glow, Zoom, Color, or Dim.
- **Scroll Behavior**: Smooth or Instant scrolling.
- **Scroll Alignment**: Center, Nearest, Top, or Off.
- **Preview Alignment**: Left, Center, or Right.
- **Typography**: Adjust font size (Small to X-Large) and line spacing (Compact to Relaxed).
- **Translation Layout**: Side-by-side or Stacked view.
- **Karaoke Fill**: Customize the fill track target (Main, Secondary, or Both) and easing function (Linear or Ease-in-out).
- **Reading Format**: Display ruby annotations as Hiragana or Katakana.
- **Lock Layout**: Prevent accidental resizing of editor panels.

**Export**
- **Formats**: Default formats for copying and downloading (LRC or SRT).
- **Timestamp Precision**: Hundredths (default) or Thousandths for both line and word-level timestamps.
- **Filename Pattern**: Fixed (`lyrics.lrc`) or derived from the Media Title.
- **Formatting Options**: Windows (CRLF) or Unix (LF) line endings, strip empty lines, normalize timestamps, and include metadata tags.

**Shortcuts**
- Configure all 18 keybindings and mouse modifiers across the Editor, Player, and Preview namespaces. Includes built-in conflict detection.

**Advanced**
- **Autosave**: Toggle autosave and configure the interval (10 to 300 seconds).
- **Timezone**: Auto-detect or manually set the timezone used for server snapshots.

**Connections & Profile**
- Manage Spotify OAuth linkage, update your display name/avatar, and change your account password.

### Authentication

- **Account registration and login** — Email/password authentication.
- **Guest Mode** — Try out the editor with full capabilities without signing in; seamless account transition keeps your draft intact.
- **Spotify OAuth** — Connect/disconnect a Spotify account for streaming tracks.
- **Profile page** — View and update display name, avatar, and account details.
- **Admin dashboard** — Manage users and content (admin role only).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [React 19](https://react.dev/) |
| Build Tool | [Vite 8](https://vitejs.dev/) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) |
| Animations | [Framer Motion](https://www.framer.com/motion/) |
| Audio Waveform | [WaveSurfer.js](https://wavesurfer-js.org/) |
| UI Primitives | [Radix UI](https://www.radix-ui.com/) |
| Internationalization | [i18next](https://www.i18next.com/) |
| Routing | [React Router v7](https://reactrouter.com/) |
| Virtualization | [TanStack Virtual](https://tanstack.com/virtual) |

---

## Getting Started

### Using Docker (Recommended for easy setup)

> [!IMPORTANT]
> **Ensure Docker Desktop is running** before executing these commands. If you are on Windows, make sure the Docker engine has fully initialized.

If you have Docker and Docker Compose installed, you can start the entire stack with a single command:

```bash
docker-compose up -d --build
```

This will:
1. Build the client (Nginx + static files)
2. Build the server (Node.js)
3. Start a MongoDB instance
4. Connect everything together

The application will be available at [http://localhost](http://localhost).

For advanced Docker configuration, production deployment, and troubleshooting, see the [Docker Containerization Guide](../../DOCKER.md).

---

### Manual Installation

### Prerequisites

- Node.js v18 or higher
- npm

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/crimsonCarnival/lrc-studio.git
   cd lrc-studio
   ```

2. Install dependencies for both client and server:

   ```bash
   # Install client dependencies
   cd client
   npm install

   # In a separate terminal, install server dependencies
   cd ../server
   npm install
   ```

3. Configure environment:

   **Client (`client/.env`):**
   ```bash
   cp .env.example .env
   # Ensure VITE_API_URL is set to http://localhost:3000 for local dev
   ```

   **Server (`server/.env`):**
   ```bash
   cp .env.example .env
   # Set your MONGODB_URI and other required keys
   ```

4. Start the development servers:

   **Server:**
   ```bash
   cd server
   npm run dev
   ```

   **Client:**
   ```bash
   cd client
   npm run dev
   ```

5. Open [http://127.0.0.1:5173](http://127.0.0.1:5173) in your browser.

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Build the production bundle |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |

---

## Docker Deployment Considerations

### With Docker Compose (Default Values)

When you run `docker-compose up` without providing custom environment variables, the following features are **immediately available**:

✅ **Working with defaults:**

- User authentication (register, login, logout)
- Profile management
- Project CRUD operations
- Lyrics editing and management
- Audio uploads (local files, drag-and-drop)
- Core editor features (LRC/SRT/Words modes)
- All keyboard shortcuts and settings
- All UI themes and customization options

⚠️ **Limited with defaults (dummy API keys):**

- **Password reset emails** — The flow works, but emails won't send (uses dummy SMTP credentials)
- **Cloudinary uploads** — Uses demo account with storage/bandwidth limitations
- **Spotify integration** — Won't connect without real credentials
- **YouTube integration** — Won't fetch video metadata with dummy API key
- **Genius lyrics** — Search and one-click import won't work (requires a Genius Client Access Token)
- **reCAPTCHA** — Uses Google's public test key (always passes validation)

### Enabling Full Features

To use all features including email, file uploads, and third-party integrations, you'll need to provide real API credentials:

1. **Create a `.env.local` file** based on `.env.docker`:
   ```bash
   cp .env.docker .env.local
   ```

2. **Add your real credentials:**

   ```bash
   # Email (for password reset)
   EMAIL_SMTP_HOST=smtp.gmail.com
   EMAIL_SMTP_USER=your-email@gmail.com
   EMAIL_SMTP_PASS=your-app-password

   # Cloudinary (for file uploads)
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret

   # Spotify (for music streaming)
   SPOTIFY_CLIENT_ID=your-client-id
   SPOTIFY_CLIENT_SECRET=your-client-secret

    # YouTube (for video metadata)
    YOUTUBE_API_KEY=your-youtube-api-key

    # Genius API (for lyrics search)
    GENIUS_CLIENT_ACCESS_TOKEN=your-genius-client-access-token

    # reCAPTCHA (for bot protection)
    RECAPTCHA_SECRET_KEY=your-secret-key
    VITE_RECAPTCHA_KEY=your-public-key
   ```

3. **Run with your configuration:**
   ```bash
   docker-compose --env-file .env.local up -d --build
   ```

For complete Docker configuration instructions, see the [Docker Containerization Guide](../../DOCKER.md).

---

## LRC File Format Reference

### Standard LRC

```lrc
[ti:Song Title]
[ar:Artist Name]
[al:Album Name]
[00:10.50]First line of lyrics
[00:15.20]Second line of lyrics
```

### Enhanced LRC (Word-level)

```lrc
[00:10.50]<00:10.50>Hold <00:11.00>me <00:11.40>close
[00:15.20]<00:15.20>Don't <00:15.80>let <00:16.10>go
```

### With Secondary / Furigana

Multiple lines sharing a timestamp stack vertically in compatible players:

```lrc
[00:10.50]持ち上げて
[00:10.50]mochiagete
[00:10.50]Lift me up
```

---

## License

This project is open-source and available under the MIT License.
