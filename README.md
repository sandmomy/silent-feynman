# Eugene Mierak - Sustainable Development & Innovation Portfolio

A professional, high-performance landing page and projects portal for Eugene Mierak, a consultant specializing in sustainable development, responsible investments, and innovative projects.

## 🚀 Live Demo
[https://sandmomy.github.io/silent-feynman/](https://sandmomy.github.io/silent-feynman/)

## ✨ Key Features
- **Interactive 3D Globe**: Built with `Globe.GL` and `Three.js` to visualize international project locations (Indonesia, Nigeria, Kenya).
- **Glassmorphism UI**: Modern, premium design with semi-transparent elements and subtle gradients.
- **Project Portal**: A dedicated page (`projects.html`) with a dynamic document grid.
- **Document Filtering**: Real-time filtering by category (Sustainability, Food Security, Real Estate, Investment, Technology, Research).
- **PDF Viewer Integrity**: Integrated modal for viewing project documentation without leaving the site.
- **Responsive Design**: Fully optimized for Desktop, Tablet, and Mobile.
- **Animation System**: Smooth entry animations for content and interactive diagram connection lines.

## 📁 Project Structure
The project is organized into a clean, flat directory structure:

```text
/silent-feynman/
├── index.html          # Landing Page (Hero, Globe, About, Contact)
├── projects.html       # Works Portal (Document Grid & Filters)
├── css/
│   └── styles.css      # Custom design system and layout rules
├── js/
│   ├── main.js         # Landing page logic (Globe, Animations, Carousel)
│   ├── projects.js     # Project page logic (Filtering, Modals)
│   └── documents-data.js # Central repository for project documents data
└── README.md           # Project documentation (this file)
```

## 🛠️ Technologies
- **HTML5 / CSS3**: Vanilla implementation for maximum performance.
- **JavaScript (ES6+)**: Custom logic for interactivity.
- **Globe.gl**: WebGL-based visualization for the interactive Earth.
- **Three.js**: Graphics engine for 3D elements.
- **Google Fonts**: 'Inter' and 'Playfair Display' for high-end typography.

## 🔌 Local Development
To run this project locally, you can use any static file server.
For example, using Node.js:
```bash
npx serve .
```

## 🌐 Deployment
This project is automatically deployed to **GitHub Pages** from the `main` branch.

---
*Created by Eugene Mierak Portfolio Team.*
