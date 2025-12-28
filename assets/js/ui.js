// assets/js/ui.js

document.addEventListener("DOMContentLoaded", () => {
    
    // --- 1. INJECT CURSOR HTML ---
    // Only on desktops (devices with fine pointers)
    if (window.matchMedia("(pointer: fine)").matches) {
        const dot = document.createElement("div");
        dot.className = "cursor-dot";
        const outline = document.createElement("div");
        outline.className = "cursor-outline";
        
        document.body.appendChild(dot);
        document.body.appendChild(outline);

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

        // Hover Effect
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
    const overlay = document.getElementById('mobile-overlay');

    if (toggleBtn && sidebar) {
        // Add mobile class helper if not present
        if(window.innerWidth < 768) {
            sidebar.classList.add('fixed', 'inset-y-0', 'left-0', 'z-40', 'sidebar-mobile');
            // Remove 'hidden' if it was set by Tailwind's md:flex
            sidebar.classList.remove('hidden');
        }

        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            if(overlay) overlay.classList.toggle('hidden');
        });

        // Close when clicking overlay
        if(overlay) {
            overlay.addEventListener('click', () => {
                sidebar.classList.remove('open');
                overlay.classList.add('hidden');
            });
        }
    }
});