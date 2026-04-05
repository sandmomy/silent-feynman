/**
 * Documents Data for Eugene Mierak Portfolio
 * Updated: All files from PDFS folder (no duplicates)
 */

const DOCUMENTS_DATA = [
    // 🌿 Sustainability
    {
        id: 1,
        title: "Ecological Sustainable Mining Introduction",
        filename: "Ecological_Sustainable_Mining_Introduction.pdf",
        category: "sustainability",
        categoryId: "sustainability",
        categoryLabel: "🌿 Sustainability",
        type: "PDF",
        thumbnail: "assets/thumbnails/ecological_mining.png",
        description: "Overview of eco-friendly mining practices and environmental preservation methods.",
        lat: -6.2088,
        lng: 106.8456 // Jakarta, Indonesia
    },
    {
        id: 2,
        title: "Project EcoPro",
        filename: "Project_EcoPro.pdf",
        category: "sustainability",
        categoryId: "sustainability",
        categoryLabel: "🌿 Sustainability",
        type: "PDF",
        thumbnail: "assets/thumbnails/project_ecopro.png",
        description: "Sustainable mineral extraction project with zero environmental impact goals.",
        lat: -0.7893,
        lng: 113.9213 // Kalimantan, Indonesia
    },
    {
        id: 3,
        title: "Gold Process",
        filename: "Gold_Process.pdf",
        category: "sustainability",
        categoryId: "sustainability",
        categoryLabel: "🌿 Sustainability",
        type: "PDF",
        thumbnail: "assets/thumbnails/gold_process.png",
        description: "Innovative gold processing techniques using eco-friendly technologies."
    },

    // 🍴 Food Security
    {
        id: 4,
        title: "SBDI Food Security Project",
        filename: "SBDI_Food_Security_Unity.pdf",
        category: "food",
        categoryId: "food",
        categoryLabel: "🍴 Food Security",
        type: "PDF",
        thumbnail: "assets/thumbnails/sbdi_food_security.png",
        description: "Comprehensive food security initiative promoting unity and sustainable agriculture.",
        lat: -1.2921,
        lng: 36.8219 // Nairobi, Kenya
    },
    {
        id: 5,
        title: "Indonesia-Africa Food Security Research",
        filename: "Joint_Research_Indonesia_Africa.pdf",
        category: "food",
        categoryId: "food",
        categoryLabel: "🍴 Food Security",
        type: "PDF",
        thumbnail: "assets/thumbnails/indonesia_africa_research.png",
        description: "Joint research collaboration between Indonesia and Africa on global food security.",
        lat: 9.0820,
        lng: 8.6753 // Nigeria
    },
    {
        id: 6,
        title: "Book of Research - Cassava",
        filename: "Book_Of_Research_Cassava.pdf",
        category: "food",
        categoryId: "food",
        categoryLabel: "🍴 Food Security",
        type: "PDF",
        thumbnail: "assets/thumbnails/cassava_research.png",
        description: "In-depth research on cassava cultivation and its role in food security."
    },
    {
        id: 7,
        title: "Rumah Mocaf - Impact Report 2023",
        filename: "Rumah_Mocaf_Impact_Report_2023.pdf",
        category: "food",
        categoryId: "food",
        categoryLabel: "🍴 Food Security",
        type: "PDF",
        thumbnail: "assets/thumbnails/rumah_mocaf.png",
        description: "Annual impact report on mocaf production and community development."
    },
    {
        id: 8,
        title: "Book of Recipe BFC 2",
        filename: "Book_Of_Recipe_BFC_2.pdf",
        category: "food",
        categoryId: "food",
        categoryLabel: "🍴 Food Security",
        type: "PDF",
        thumbnail: "assets/thumbnails/recipe_book.png",
        description: "Collection of healthy recipes using sustainable local ingredients."
    },
    {
        id: 9,
        title: "Project Remote Farming",
        filename: "Project_Remote_Farming.pdf",
        category: "food",
        categoryId: "food",
        categoryLabel: "🍴 Food Security",
        type: "PDF",
        thumbnail: "assets/thumbnails/remote_farming.png",
        description: "Smart farming solutions for remote and rural communities."
    },
    {
        id: 10,
        title: "Eko Vitaris - Premium Tropical Products",
        filename: "Eko_Vitaris_EN.pdf",
        category: "food",
        categoryId: "food",
        categoryLabel: "🍴 Food Security",
        type: "PDF",
        thumbnail: "assets/thumbnails/eko_vitaris_en.png",
        description: "Expert in premium tropical products: coconuts, Modified Cassava Flour (Mocaf), and specialty coffee from Indonesia.",
        lat: -7.2575,
        lng: 112.7521 // Java, Indonesia
    },

    // 🏨 Real Estate
    {
        id: 11,
        title: "SHANAYA PROJECT",
        filename: "Shanaya_Project.pdf",
        category: "realestate",
        categoryId: "realestate",
        categoryLabel: "🏨 Real Estate",
        type: "PDF",
        thumbnail: "assets/thumbnails/shanaya_project.png",
        description: "Luxury sustainable resort development in prime location.",
        lat: -7.9666,
        lng: 112.6326 // Malang, Indonesia
    },
    {
        id: 12,
        title: "Shanaya Resort 2025 - Investment Proposal",
        filename: "Shanaya_Resort_Investment_2025.pdf",
        category: "realestate",
        categoryId: "realestate",
        categoryLabel: "🏨 Real Estate",
        type: "PDF",
        thumbnail: "assets/thumbnails/shanaya_investment.png",
        description: "Investment opportunity for eco-luxury resort with projected returns."
    },
    {
        id: 13,
        title: "Ladang Lina Brochure",
        filename: "Ladang_Lina_Brochure.pdf",
        category: "realestate",
        categoryId: "realestate",
        categoryLabel: "🏨 Real Estate",
        type: "PDF",
        thumbnail: "assets/thumbnails/ladang_lina.png",
        description: "Agricultural land development project with residential elements."
    },
    {
        id: 14,
        title: "Bangalang Brochure",
        filename: "Bangalang_Brochure.pdf",
        category: "realestate",
        categoryId: "realestate",
        categoryLabel: "🏨 Real Estate",
        type: "PDF",
        thumbnail: "assets/thumbnails/bangalang.png",
        description: "Beachfront property development with sustainable design principles."
    },
    {
        id: 15,
        title: "Mariposa Batu - Investment Deck",
        filename: "Mariposa_Batu_Investment.pdf",
        category: "realestate",
        categoryId: "realestate",
        categoryLabel: "🏨 Real Estate",
        type: "PDF",
        thumbnail: "assets/thumbnails/mariposa_batu.png",
        description: "Premium villa development in scenic mountain location."
    },
    {
        id: 16,
        title: "Social Production Hub",
        filename: "Project_Social_Production_Hub.pdf",
        category: "realestate",
        categoryId: "realestate",
        categoryLabel: "🏨 Real Estate",
        type: "PDF",
        thumbnail: "assets/thumbnails/social_hub.png",
        description: "Community-focused production facility combining housing and workspace."
    },
    {
        id: 17,
        title: "Hacienda Retreat Brochure",
        filename: "Hacienda_Retreat_Brochure.docx",
        category: "realestate",
        categoryId: "realestate",
        categoryLabel: "🏨 Real Estate",
        type: "DOCX",
        thumbnail: "assets/thumbnails/hacienda_retreat.png",
        description: "Sustainable eco-retreat development with holistic wellness focus."
    },

    // 💰 Investment & Business
    {
        id: 18,
        title: "Indonesia Investment Guide",
        filename: "Indonesia_Investment_Guide_2023_2024.pdf",
        category: "investment",
        categoryId: "investment",
        categoryLabel: "💰 Investment",
        type: "PDF",
        thumbnail: "assets/thumbnails/indo_investment_guide.png",
        description: "Complete guide to sustainable investment opportunities in Indonesia."
    },
    {
        id: 19,
        title: "Business Plan SBDI - SDG Design Lab",
        filename: "Business_Plan_SBDI_SDG.pdf",
        category: "investment",
        categoryId: "investment",
        categoryLabel: "💰 Investment",
        type: "PDF",
        thumbnail: "assets/thumbnails/business_plan_sbdi_sdg.png",
        description: "Business plan aligned with UN Sustainable Development Goals."
    },
    {
        id: 20,
        title: "Public Private Partnership Cooperative",
        filename: "PPP_Cooperative.pdf",
        category: "investment",
        categoryId: "investment",
        categoryLabel: "💰 Investment",
        type: "PDF",
        thumbnail: "assets/thumbnails/ppp_cooperative.png",
        description: "Framework for public-private partnership in cooperative ventures."
    },
    {
        id: 21,
        title: "Gold Investment Event Indonesia",
        filename: "Exclusive_Gold_Investment_Event.pdf",
        category: "investment",
        categoryId: "investment",
        categoryLabel: "💰 Investment",
        type: "PDF",
        thumbnail: "assets/thumbnails/exclusive_gold_investment_event.png",
        description: "Exclusive investment event details and partnership opportunities."
    },
    {
        id: 22,
        title: "SBDI Center Foundation",
        filename: "SBDI_Center_Foundation.pdf",
        category: "investment",
        categoryId: "investment",
        categoryLabel: "💰 Investment",
        type: "PDF",
        thumbnail: "assets/thumbnails/sbdi_center_foundation.png",
        description: "Foundation overview and strategic development objectives."
    },
    {
        id: 23,
        title: "SBDI Foundation Road Map",
        filename: "SBDI_Foundation_Roadmap.pdf",
        category: "investment",
        categoryId: "investment",
        categoryLabel: "💰 Investment",
        type: "PDF",
        thumbnail: "assets/thumbnails/sbdi_foundation_roadmap.png",
        description: "Strategic roadmap for foundation growth and impact."
    },
    {
        id: 24,
        title: "Event Proposal",
        filename: "Event_Proposal.docx",
        category: "investment",
        categoryId: "investment",
        categoryLabel: "💰 Investment",
        type: "DOCX",
        thumbnail: "assets/contact-bg.jpg",
        description: "Professional event proposal for business networking and partnerships."
    },
    {
        id: 25,
        title: "Hiyejo Indogold - Sales Agreement",
        filename: "Hiyejo_Indogold_Agreement.docx",
        category: "investment",
        categoryId: "investment",
        categoryLabel: "💰 Investment",
        type: "DOCX",
        thumbnail: "assets/karangasem-water-temple-palace-bali.jpg",
        description: "Exclusive sales and representation agreement for gold investment."
    },

    // ⚡ Technology & Energy
    {
        id: 26,
        title: "Magnetic Vertical Wind Turbine",
        filename: "Magnetic_Vertical_Wind_Turbine.pdf",
        category: "technology",
        categoryId: "technology",
        categoryLabel: "⚡ Technology",
        type: "PDF",
        thumbnail: "assets/thumbnails/magnetic_vertical_wind_turbine.png",
        description: "Innovative magnetic wind turbine design for efficient energy generation."
    },
    {
        id: 27,
        title: "Rijnenberg Vortex Atom Theory",
        filename: "Rijnenberg_Vortex_Theory.pdf",
        category: "technology",
        categoryId: "technology",
        categoryLabel: "⚡ Technology",
        type: "PDF",
        thumbnail: "assets/thumbnails/rijnenberg_vortex_theory.png",
        description: "Groundbreaking theoretical physics research on atomic vortex dynamics."
    },

    // 📚 Research
    {
        id: 28,
        title: "WiseUse R&D Book",
        filename: "WiseUse_RD_Book.pdf",
        category: "research",
        categoryId: "research",
        categoryLabel: "📚 Research",
        type: "PDF",
        thumbnail: "assets/thumbnails/wiseuse_rd_book.png",
        description: "Comprehensive R&D documentation on sustainable resource utilization."
    },

    // 🎓 Education & Social Impact
    {
        id: 29,
        title: "KNB UNISMA 2026 — Fully Funded Scholarship",
        filename: "Booklet_KNB_UNISMA_2026.pdf",
        category: "education",
        categoryId: "education",
        categoryLabel: "🎓 Education",
        type: "PDF",
        thumbnail: "assets/thumbnails/knb_unisma.jpg",
        description: "Fully funded scholarship program at Universitas Islam Malang (UNISMA), Indonesia. Covers tuition, living allowance, flights, and health insurance for Undergraduate & Master degrees.",
        lat: -7.9666,
        lng: 112.6326 // Malang, Indonesia
    },



    // 🌿 Wellness & Holistic Health
    {
        id: 31,
        title: "Biozar Original — Natural Wellness from Venezuela",
        category: "wellness",
        categoryId: "wellness",
        categoryLabel: "🌿 Wellness",
        type: "VIDEO",
        thumbnail: "assets/biozar-thumb.jpg",
        description: "Biozar Original: a natural health supplement supporting immune, digestive, and nervous system balance. Trusted by practitioners for holistic recovery and well-being.",
        externalUrl: "biozar-venezuela.html"
    }
];

const DOCUMENTS_BASE_PATH = "assets/pdfs/";
