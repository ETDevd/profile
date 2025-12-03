/*
  Slideshow for itch.io "game-column" entries.
  - Default itch.io URL: https://ducky-dev.itch.io
  - F2: change itch.io URL (prompts)
  - Left/Right arrows: previous/next
  - Auto-loop every 5s, pauses on hover
  - Smooth fade/slide animations between slides
  - Tries server API (/api/slides) first, then falls back to direct client-side fetch
  - Responsive design: adapts to mobile, tablet, and desktop
*/

(() => {
	const DEFAULT_ITCH_URL = 'https://ducky-dev.itch.io';
	const AUTO_INTERVAL_MS = 5000;
	const API_ENDPOINT = '/api/slides'; // Server-side proxy

	const titleEl = document.getElementById('slide-title');
	const descEl = document.getElementById('slide-desc');
	const imgEl = document.getElementById('slide-image');
	const linkEl = document.getElementById('slide-link');
	const itemDisplay = document.querySelector('.item_display');

	let slides = [];
	let current = 0;
	let timer = null;
	let itchUrl = DEFAULT_ITCH_URL;

	function sampleSlides() {
		return [
			{ title: 'Sample Game 1', desc: 'A sample game fallback', img: 'BG.jpg', url: 'https://ducky-dev.itch.io' },
			{ title: 'Sample Game 2', desc: 'Second sample', img: 'BG.jpg', url: 'https://ducky-dev.itch.io' }
		];
	}

	function absUrl(src, base) {
		try { return new URL(src, base).href; } catch (e) { return src; }
	}

	async function fetchSlidesFromItch(url) {
		try {
			// Try server API first (handles CORS server-side)
			const apiUrl = `${API_ENDPOINT}?url=${encodeURIComponent(url)}`;
			console.log(`Fetching from API: ${apiUrl}`);
			const res = await fetch(apiUrl);
			
			if (res.ok) {
				const slides = await res.json();
				if (Array.isArray(slides) && slides.length > 0) {
					console.log(`Got ${slides.length} slides from server API`);
					return slides;
				}
			}
		} catch (err) {
			console.warn('Server API failed, falling back to client-side fetch:', err);
		}

		// Fallback: client-side fetch (will likely fail due to CORS, but try anyway)
		try {
			const res = await fetch(url, { mode: 'cors' });
			if (!res.ok) throw new Error('Network response not ok');
			const text = await res.text();
			const parser = new DOMParser();
			const doc = parser.parseFromString(text, 'text/html');

			// Try several selector variants used by itch.io themes
			const selectors = ['.game-column', '.game_column', '.game_cell', '.project_cell', '.game_cell_wrapper'];
			let nodes = [];
			for (const s of selectors) {
				const n = Array.from(doc.querySelectorAll(s));
				if (n.length) { nodes = n; break; }
			}

			// If still empty, try listing game links on the page
			if (!nodes.length) {
				nodes = Array.from(doc.querySelectorAll('a')).filter(a => /itch.io/.test(a.href) || a.href.includes('/games/'));
			}

			const parsed = nodes.slice(0, 12).map(node => {
				// find a link and image inside this node
				const a = node.querySelector('a') || node.closest('a');
				const href = a ? a.href : url;
				const img = node.querySelector('img');
				const title = (node.querySelector('.title') && node.querySelector('.title').textContent.trim()) || (a && a.title) || (a && a.textContent.trim()) || 'Untitled';
				const desc = (node.querySelector('.description') && node.querySelector('.description').textContent.trim()) || '';
				const imgsrc = img ? img.src : null;
				return { title: title, desc: desc, img: imgsrc ? absUrl(imgsrc, url) : 'BG.jpg', url: href };
			}).filter(s => s && s.url);

			if (!parsed.length) throw new Error('No slides found');
			return parsed;
		} catch (err) {
			console.warn('Failed to fetch/parse itch.io page (CORS or structure). Using fallback slides.', err);
			return sampleSlides();
		}
	}

	function showSlide(i) {
		if (!slides.length) return;
		current = (i + slides.length) % slides.length;
		const s = slides[current];
		
		// Trigger animation: remove and re-add class to restart animation
		imgEl.style.animation = 'none';
		titleEl.style.animation = 'none';
		descEl.style.animation = 'none';
		
		// Force reflow to restart animation
		void imgEl.offsetWidth;
		
		imgEl.style.animation = '';
		titleEl.style.animation = '';
		descEl.style.animation = '';
		
		titleEl.textContent = s.title || '';
		descEl.textContent = s.desc || '';
		imgEl.src = s.img || 'BG.jpg';
		imgEl.alt = s.title || 'Slide image';
		linkEl.href = s.url || itchUrl;
	}

	function nextSlide() { showSlide(current + 1); }
	function prevSlide() { showSlide(current - 1); }

	function startAuto() {
		stopAuto();
		timer = setInterval(nextSlide, AUTO_INTERVAL_MS);
	}
	function stopAuto() {
		if (timer) { clearInterval(timer); timer = null; }
	}

	async function loadSlides(forUrl) {
		itchUrl = forUrl || itchUrl;
		slides = await fetchSlidesFromItch(itchUrl);
		showSlide(0);
		startAuto();
	}

	// Event handlers
	document.addEventListener('keydown', (e) => {
		if (e.key === 'ArrowRight') { nextSlide(); startAuto(); }
		if (e.key === 'ArrowLeft') { prevSlide(); startAuto(); }
		if (e.key === 'F2') {
			// F2 changes the itch.io link (prompts)
			const input = prompt('Enter itch.io profile or page URL', itchUrl || DEFAULT_ITCH_URL);
			if (input) {
				// Normalize: ensure it has protocol
				let normalized = input;
				if (!/^https?:\/\//i.test(normalized)) normalized = 'https://' + normalized.replace(/^\/\//, '');
				loadSlides(normalized);
			}
		}
	});

	// Pause on hover
	if (itemDisplay) {
		itemDisplay.addEventListener('mouseenter', stopAuto);
		itemDisplay.addEventListener('mouseleave', startAuto);
	}

	// Kick off with default
	window.addEventListener('load', () => {
		// Small delay in case DOM not fully ready
		loadSlides(DEFAULT_ITCH_URL);
	});

})();
