// assets/js/ui.js

document.addEventListener("DOMContentLoaded", () => {
    
    // --- 1. CUSTOM CURSOR LOGIC ---
    // Only on desktops (devices with fine pointers)
    if (window.matchMedia("(pointer: fine)").matches) {
        const dot = document.createElement("div");
        dot.className = "cursor-dot";
        const outline = document.createElement("div");
        outline.className = "cursor-outline";
        
        document.body.appendChild(dot);
        document.body.appendChild(outline);

        // Activate the CSS hide logic
        document.body.classList.add('custom-cursor-active');

        // Movement Logic
        window.addEventListener("mousemove", (e) => {
            const posX = e.clientX;
            const posY = e.clientY;

            // Dot follows instantly
            dot.style.left = `${posX}px`;
            dot.style.top = `${posY}px`;

            // Outline follows with physics (animation)
            outline.animate({
                left: `${posX}px`,
                top: `${posY}px`
            }, { duration: 500, fill: "forwards" });
        });

        // Hover Effect on Clickables
        const clickables = document.querySelectorAll("a, button, input, select, textarea, .cursor-pointer");
        clickables.forEach(el => {
            el.addEventListener("mouseenter", () => document.body.classList.add("hovering"));
            el.addEventListener("mouseleave", () => document.body.classList.remove("hovering"));
        });
    }

    // --- 2. MOBILE SIDEBAR LOGIC ---
    // Finds the hamburger button and the sidebar
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('aside');
    
    // Create overlay if it doesn't exist
    let overlay = document.getElementById('mobile-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'mobile-overlay';
        overlay.className = "fixed inset-0 bg-black/50 z-30 hidden md:hidden glass-overlay";
        document.body.appendChild(overlay);
    }

    if (toggleBtn && sidebar) {
        // Ensure sidebar has mobile classes
        if(window.innerWidth < 768) {
            sidebar.classList.add('fixed', 'inset-y-0', 'left-0', 'z-40', 'sidebar-mobile');
            sidebar.classList.remove('hidden'); // Remove Tailwind's hidden class if present
        }

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent immediate close
            sidebar.classList.toggle('open');
            overlay.classList.toggle('hidden');
        });

        // Close when clicking overlay
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.add('hidden');
        });
    }
});