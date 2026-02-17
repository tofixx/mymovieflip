# MovieFlip (GitHub Pages)

A static movie swipe app you can deploy on GitHub Pages.

## Features

- Swipe decisions: `Like`, `Dislike`, `Watched`
- User profile saved in `localStorage`
- Watched movies can be rated (1-5)
- Recommendations start after 10 flips
- New/unseen movies are prioritized (watched/seen are excluded)

## Free Movie Data Source

This app uses [TMDB](https://www.themoviedb.org/) (free API with account + token).

1. Create a free account.
2. Generate a **Read Access Token** in API settings.
3. Open the app, paste token, and click `Save Key`.

## Run locally

Open `index.html` directly, or use a static server:

```powershell
python -m http.server 5500
```

Then open `http://localhost:5500`.

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. In GitHub: `Settings` -> `Pages`.
3. Under `Build and deployment`, choose:
   - `Source`: Deploy from a branch
   - `Branch`: `main` (or your default), `/ (root)`
4. Save and wait for deployment.

Your site will be available at:

`https://<your-username>.github.io/<your-repo>/`

## Notes

- The TMDB token is stored in browser `localStorage`.
- For production, create a TMDB key/token with domain restrictions where possible.
- Keyboard shortcuts: `ArrowRight` = Like, `ArrowLeft` = Dislike, `ArrowUp` = Watched.
