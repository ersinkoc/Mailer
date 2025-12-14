# @oxog/mailer Documentation Website

This folder contains the static documentation website for @oxog/mailer, deployed to [mailer.oxog.dev](https://mailer.oxog.dev) via GitHub Pages.

## Tech Stack

- **Tailwind CSS** - Utility-first CSS framework for rapid UI development
- **Alpine.js** - Lightweight JavaScript framework for interactivity
- **CDN-based** - No build process required, deployed directly from this folder

## Features

- 📱 Fully responsive design
- 🌙 Dark mode support
- ✨ Smooth animations and transitions
- 📋 Copy-to-clipboard functionality
- 🎨 Modern gradient design
- 🔍 SEO optimized

## Deployment

The website is automatically deployed to GitHub Pages when changes are pushed to the `main` branch.

### Manual Deployment

1. Ensure all files are in this directory
2. Push to the `main` branch
3. GitHub Pages will automatically serve the site from this folder

### Custom Domain

The site is configured to use `mailer.oxog.dev` as a custom domain via the `CNAME` file.

## File Structure

```
website/
├── index.html          # Main documentation page
├── CNAME              # Custom domain configuration
├── .nojekyll          # Disable Jekyll processing
└── README.md          # This file
```

## Local Development

Simply open `index.html` in your browser, or use a local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .

# Using PHP
php -S localhost:8000
```

Then visit `http://localhost:8000`

## Contributing

To update the documentation:

1. Edit `index.html`
2. Test locally by opening in a browser
3. Commit and push changes
4. The site will be automatically updated on GitHub Pages

## License

MIT License - Same as the main project
