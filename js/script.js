// Map vertical mouse wheel to horizontal scroll for the frames container.
// Allows free horizontal scrolling with a regular mouse wheel.
(function () {
	function disableImageDragging(root) {
		const scope = root || document;
		scope.querySelectorAll('img').forEach((img) => {
			img.setAttribute('draggable', 'false');
			img.draggable = false;
		});
	}

	document.addEventListener('DOMContentLoaded', () => {
		disableImageDragging(document);
		// Keep newly added images non-draggable (e.g., dynamic popup/media content).
		const mo = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				mutation.addedNodes.forEach((node) => {
					if (!(node instanceof Element)) return;
					if (node.tagName === 'IMG') {
						node.setAttribute('draggable', 'false');
						node.draggable = false;
						return;
					}
					disableImageDragging(node);
				});
			});
		});
		mo.observe(document.body, { childList: true, subtree: true });
	});

	// Block native drag initiation so pointer dragging remains available for horizontal scrolling.
	document.addEventListener('dragstart', (e) => {
		const target = e.target;
		if (target && target.tagName === 'IMG') e.preventDefault();
	});

	const container = document.getElementById('frames');
	if (!container) return;

	let wheelMomentum = 0;
	let wheelRaf = 0;

	function animateWheelScroll() {
		if (Math.abs(wheelMomentum) < 0.1) {
			wheelMomentum = 0;
			wheelRaf = 0;
			return;
		}
		container.scrollLeft += wheelMomentum;
		wheelMomentum *= 0.86;
		wheelRaf = requestAnimationFrame(animateWheelScroll);
	}

	// Wheel -> horizontal mapping (vertical wheel scrolls horizontally)
	container.addEventListener('wheel', function (e) {
		const absX = Math.abs(e.deltaX);
		const absY = Math.abs(e.deltaY);
		if (absY > absX) {
			e.preventDefault();
			const modeFactor = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? container.clientWidth : 1);
			const normalizedDelta = e.deltaY * modeFactor;
			wheelMomentum += normalizedDelta * 0.35;
			if (!wheelRaf) wheelRaf = requestAnimationFrame(animateWheelScroll);
		}
	}, { passive: false });

	// Drag-to-scroll (mouse)
	let isDown = false;
	let startX = 0;
	let scrollLeft = 0;

	container.addEventListener('mousedown', (e) => {
		isDown = true;
		container.classList.add('grabbing');
		startX = e.pageX - container.offsetLeft;
		scrollLeft = container.scrollLeft;
	});

	container.addEventListener('mouseleave', () => {
		isDown = false;
		container.classList.remove('grabbing');
	});

	container.addEventListener('mouseup', () => {
		isDown = false;
		container.classList.remove('grabbing');
	});

	container.addEventListener('mousemove', (e) => {
		if (!isDown) return;
		e.preventDefault();
		const x = e.pageX - container.offsetLeft;
		const walk = (x - startX);
		container.scrollLeft = scrollLeft - walk;
	});

	// Touch support (drag)
	container.addEventListener('touchstart', (e) => {
		startX = e.touches[0].pageX - container.offsetLeft;
		scrollLeft = container.scrollLeft;
	}, { passive: true });

	container.addEventListener('touchmove', (e) => {
		const x = e.touches[0].pageX - container.offsetLeft;
		const walk = (x - startX);
		container.scrollLeft = scrollLeft - walk;
	}, { passive: true });

	// Keyboard navigation (left/right)
	window.addEventListener('keydown', function (e) {
		if (e.key === 'ArrowRight') container.scrollLeft += window.innerWidth;
		if (e.key === 'ArrowLeft') container.scrollLeft -= window.innerWidth;
	});
})();

// Set playbackRate for the noise overlay video (grain effect)
(function () {
	document.addEventListener('DOMContentLoaded', () => {
		const noiseVideo = document.querySelector('#noise-overlay video');
		if (!noiseVideo) return;
		const attr = noiseVideo.getAttribute('data-playback-rate');
		let rate = 0.5;
		if (attr) {
			const parsed = parseFloat(attr);
			if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 4) rate = parsed;
		}
		const applyRate = () => { try { noiseVideo.playbackRate = rate; } catch (e) { } };
		noiseVideo.addEventListener('loadedmetadata', applyRate, { once: true });
		noiseVideo.addEventListener('play', applyRate);
		applyRate();
	});
})();

/* Custom horizontal scrollbar logic: draggable thumb, clickable stops, and snap-to-stops */
(function () {
	const frames = document.getElementById('frames');
	const track = document.getElementById('cs-track');
	const thumb = document.getElementById('cs-thumb');
	const cart = document.getElementById('cs-cart');
	const stopsContainer = document.getElementById('cs-stops');
	if (!frames || !track || !stopsContainer) return; // thumb/cart optional
	// ensure cart isn't draggable and prevent native image drag behavior
	if (cart) {
		try { cart.setAttribute('draggable', 'false'); } catch (e) { }
		cart.addEventListener('dragstart', (ev) => ev.preventDefault());
		cart.style.touchAction = 'none';
	}

	// Navigation stops (frames with marked positions). Extend as needed.
	const stopsFrames = [1, 3, 5, 10, 14, 23, 25, 27];
	let maxScroll = 0;
	let trackRect = null;
	let dragging = false;
	const thumbRadius = 14 / 2;
	const stopRadius = 8 / 2;

	function recalc() {
		maxScroll = Math.max(0, frames.scrollWidth - frames.clientWidth);
		trackRect = track.getBoundingClientRect();
		renderStops();
		updateThumbPosition();
	}

	function renderStops() {
		stopsContainer.innerHTML = '';
		if (maxScroll <= 0) return;
		const trackW = track.clientWidth;
		const usable = trackW - 2 * thumbRadius; // ensure stops don't place centers under edges
		stopsFrames.forEach((f) => {
			const stop = document.createElement('div');
			stop.className = 'cs-stop';
			stop.dataset.frame = String(f);
			const offset = (f - 1) * frames.clientWidth;
			const t = maxScroll > 0 ? (offset / maxScroll) : 0;
			const centerX = thumbRadius + t * (trackW - 2 * thumbRadius);
			stop.style.left = centerX + 'px';
			stop.title = 'Go to frame ' + f;
			stop.addEventListener('click', (e) => {
				e.stopPropagation();
				const left = Math.min(maxScroll, Math.max(0, (f - 1) * frames.clientWidth));
				frames.scrollTo({ left: left, behavior: 'smooth' });
			});
			stopsContainer.appendChild(stop);
		});
	}

	// Popup buttons mapping per frame index
	const popupMap = {
		3: [1, 2],
		5: [3, 4, 5],
		6: [3, 4, 5],
		10: [6],
		11: [6],
		14: [7],
		15: [7],
		16: [7],
		23: [8],
		25: [9]
	};

	// Display names for each popup id
	const popupNames = {
		1: 'Population Growth',
		2: 'Black Gold',
		3: 'Closure',
		4: 'Unemployment',
		5: 'Promises',
		6: 'Safety Nets',
		7: 'Operation Hartslag',
		8: 'Well-being',
		9: 'Heerlen-North'
	};

	// Create UI container for popup buttons (above the cart)
	const popupUI = document.createElement('div');
	popupUI.id = 'cs-popup-buttons';
	track.appendChild(popupUI);

	let lastFrameShown = null;
	let lastButtonsSignature = null; // sorted ids signature to avoid flicker across frames with same buttons

	function computeSignature(ids) {
		if (!Array.isArray(ids) || !ids.length) return '';
		try { return ids.slice().sort((a, b) => a - b).join(','); } catch (e) { return ids.join(','); }
	}

	let isAnimatingOut = false;

	function toWeakColor(c) {
		try {
			// Normalize to rgba(r,g,b,0.35)
			if (!c) return 'rgba(180,21,42,0.35)';
			if (c.startsWith('#')) {
				const hex = c.replace('#', '');
				const r = parseInt(hex.substring(0, 2), 16);
				const g = parseInt(hex.substring(2, 4), 16);
				const b = parseInt(hex.substring(4, 6), 16);
				return `rgba(${r}, ${g}, ${b}, 0.35)`;
			}
			if (c.startsWith('rgb(')) {
				const nums = c.match(/rgb\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)/);
				if (nums) { const r = nums[1], g = nums[2], b = nums[3]; return `rgba(${r}, ${g}, ${b}, 0.35)`; }
			}
			return 'rgba(180,21,42,0.35)';
		} catch (e) { return 'rgba(180,21,42,0.35)'; }
	}

	function setPopupAccent(frameIdx) {
		try {
			const section = document.querySelector('.frame-' + frameIdx);
			let accent = '#B4152A';
			if (section) {
				// prefer SVG fill color if present
				const filled = section.querySelector('svg [fill]');
				if (filled) {
					const f = filled.getAttribute('fill');
					if (f) accent = f;
				} else {
					// fallback: computed color of first heading or span
					const candidate = section.querySelector('h1, h2, h3, h4, span');
					if (candidate) {
						const cs = getComputedStyle(candidate);
						if (cs && cs.color) accent = cs.color;
					}
				}
			}
			popupUI.style.setProperty('--popup-accent', accent);
			popupUI.style.setProperty('--popup-accent-weak', toWeakColor(accent));
		} catch (e) { }
	}

	function createButtonsForFrame(frameIdx) {
		if (!frameIdx || !popupMap[frameIdx]) {
			popupUI.style.display = 'none';
			lastFrameShown = null;
			lastButtonsSignature = null;
			return;
		}
		setPopupAccent(frameIdx);
		popupUI.innerHTML = '';
		const ids = popupMap[frameIdx];
		lastButtonsSignature = computeSignature(ids);
		ids.forEach((n, idx) => {
			const btn = document.createElement('button');
			btn.className = 'btn';
			const label = popupNames[n] || ('Popup ' + n);
			btn.textContent = label;
			btn.title = 'Open ' + label;
			btn.dataset.modal = 'popupModal' + n;
			btn.classList.add('btn-appear');
			try { btn.style.setProperty('--appear-delay', (idx * 80) + 'ms'); } catch (e) { }
			popupUI.appendChild(btn);
		});
		popupUI.style.display = 'block';
		lastFrameShown = frameIdx;
	}

	function animateButtonsOut(nextFrameIdx) {
		if (isAnimatingOut) return;
		const existing = Array.from(popupUI.querySelectorAll('button'));
		if (!existing.length) {
			if (nextFrameIdx) createButtonsForFrame(nextFrameIdx);
			else { popupUI.style.display = 'none'; lastFrameShown = null; lastButtonsSignature = null; }
			return;
		}
		isAnimatingOut = true;
		let finished = 0;
		existing.forEach((btn, idx) => {
			btn.classList.remove('btn-appear');
			btn.classList.add('btn-disappear');
			try { btn.style.setProperty('--disappear-delay', (idx * 60) + 'ms'); } catch (e) { }
			const onEnd = (ev) => {
				if (ev.animationName !== 'csBtnDisappear') return;
				btn.removeEventListener('animationend', onEnd);
				finished++;
				if (finished === existing.length) {
					popupUI.innerHTML = '';
					isAnimatingOut = false;
					if (nextFrameIdx) createButtonsForFrame(nextFrameIdx);
					else { popupUI.style.display = 'none'; lastFrameShown = null; lastButtonsSignature = null; }
				}
			};
			btn.addEventListener('animationend', onEnd);
		});
	}

	function renderPopupButtonsForFrame(frameIdx) {
		const ids = popupMap[frameIdx];
		const currentSig = computeSignature(ids);
		// If no buttons should be shown, animate out and stop
		if (!ids || !ids.length) { animateButtonsOut(null); return; }
		// If the signature matches the last rendered set, keep existing buttons (no flicker)
		if (lastButtonsSignature === currentSig && popupUI.childElementCount > 0) {
			popupUI.style.display = 'block';
			setPopupAccent(frameIdx);
			lastFrameShown = frameIdx;
			return;
		}
		// Otherwise transition to the new set
		if (popupUI.childElementCount > 0) {
			animateButtonsOut(frameIdx);
		} else {
			createButtonsForFrame(frameIdx);
		}
	}

	function updateThumbPosition() {
		if (!trackRect) trackRect = track.getBoundingClientRect();
		const trackW = track.clientWidth;
		if (maxScroll <= 0) {
			thumb.style.left = thumbRadius + 'px';
			thumb.setAttribute('aria-valuenow', '1');
			return;
		}
		const t = frames.scrollLeft / maxScroll;
		const centerX = thumbRadius + t * (trackW - 2 * thumbRadius);
		thumb.style.left = centerX + 'px';
		if (cart) cart.style.left = centerX + 'px';
		const approxFrame = Math.round(frames.scrollLeft / frames.clientWidth) + 1;
		thumb.setAttribute('aria-valuenow', String(Math.min(Math.max(1, approxFrame), 27)));

		// Position popup UI and render buttons for current frame
		popupUI.style.left = centerX + 'px';
		renderPopupButtonsForFrame(approxFrame);

		// Hide the noise video overlay after slide 17
		try {
			const noiseOverlay = document.getElementById('noise-overlay');
			if (noiseOverlay) {
				if (approxFrame > 17) noiseOverlay.style.display = 'none';
				else noiseOverlay.style.display = '';
			}
		} catch (e) { }

		// Frame 17 crossfade: begin earlier so overlay (img31) fades in before frame 17 fully enters
		try {
			const f17 = document.querySelector('.frame-17');
			const overlayImg = f17 ? f17.querySelector('#frame17-overlay') : null;
			const baseImg = f17 ? f17.querySelector('#frame17-base') : null;
			if (f17 && overlayImg && baseImg) {
				const W = frames.clientWidth;
				const frame17Start = (17 - 1) * W; // left offset where frame 17 starts
				// Start fading a full frame BEFORE frame 17 (during frame 16),
				// and complete the fade roughly midway through frame 17.
				const startLead = 0.6 * W;   // begin fade at start of frame 16
				const fadeSpan = 0.8 * W;    // finish around ~60% into frame 17
				const progress = Math.min(Math.max((frames.scrollLeft - (frame17Start - startLead)) / fadeSpan, 0), 1);
				overlayImg.style.opacity = String(progress);
			}
		} catch (e) { }
	}

	// Sync frames -> thumb
	frames.addEventListener('scroll', () => {
		if (!dragging) updateThumbPosition();
	}, { passive: true });

	// Pointer drag on cart (cart replaces visual thumb)
	const dragSource = cart || thumb;
	dragSource.addEventListener('pointerdown', (e) => {
		dragging = true;
		try { dragSource.setPointerCapture(e.pointerId); } catch (err) { }
		if (cart) cart.style.cursor = 'grabbing';
		if (thumb) thumb.style.cursor = 'grabbing';
	});

	dragSource.addEventListener('pointermove', (e) => {
		if (!dragging) return;
		if (!trackRect) trackRect = track.getBoundingClientRect();
		const trackW = track.clientWidth;
		const x = e.clientX - trackRect.left;
		const clamped = Math.min(Math.max(thumbRadius, x), trackW - thumbRadius);
		const t = (clamped - thumbRadius) / (trackW - 2 * thumbRadius);
		const left = t * maxScroll;
		frames.scrollLeft = left;
		updateThumbPosition();
	});

	function endDrag(e) {
		if (!dragging) return;
		dragging = false;
		try { dragSource.releasePointerCapture(e.pointerId); } catch (err) { }
		if (cart) cart.style.cursor = 'grab';
		if (thumb) thumb.style.cursor = 'grab';
		snapToNearestStop();
	}
	dragSource.addEventListener('pointerup', endDrag);
	dragSource.addEventListener('pointercancel', endDrag);

	// Click on track to jump
	track.addEventListener('click', (e) => {
		if (!trackRect) trackRect = track.getBoundingClientRect();
		const trackW = track.clientWidth;
		const x = e.clientX - trackRect.left;
		const clamped = Math.min(Math.max(thumbRadius, x), trackW - thumbRadius);
		const t = (clamped - thumbRadius) / (trackW - 2 * thumbRadius);
		const left = t * maxScroll;
		frames.scrollTo({ left: left, behavior: 'smooth' });
		// after animation, snap slightly to nearest stop
		setTimeout(snapToNearestStop, 300);
	});

	function snapToNearestStop() {
		if (maxScroll <= 0) return;
		const current = frames.scrollLeft;
		// compute target scroll positions for all stops
		const targets = stopsFrames.map(f => Math.min(maxScroll, Math.max(0, (f - 1) * frames.clientWidth)));
		let nearest = targets[0];
		let bestDist = Math.abs(current - nearest);
		for (let i = 1; i < targets.length; i++) {
			const d = Math.abs(current - targets[i]);
			if (d < bestDist) { bestDist = d; nearest = targets[i]; }
		}
		// Only snap if within a reasonable distance (one frame width) to avoid too aggressive snapping
		if (bestDist <= frames.clientWidth * 0.6) {
			frames.scrollTo({ left: nearest, behavior: 'smooth' });
		}
	}

	// Recalc on load/resize
	window.addEventListener('resize', () => { recalc(); }, { passive: true });
	window.addEventListener('load', () => { setTimeout(recalc, 50); });
	setTimeout(recalc, 20);
})();

// Fade-in reveal for headings and paragraphs when they enter the viewport
(function () {
	document.addEventListener('DOMContentLoaded', () => {
		const framesContainer = document.getElementById('frames');
		if (!framesContainer) return;
		const targets = Array.from(framesContainer.querySelectorAll('h1, h2, h3, h4, h5, h6, p'));
		if (!targets.length) return;

		// mark all targets as hidden initially (only inside frames)
		targets.forEach(el => el.classList.add('reveal'));

		const observer = new IntersectionObserver((entries, obs) => {
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					entry.target.classList.add('h4-visible');
					obs.unobserve(entry.target);
				}
			});
		}, { threshold: 0.12 });

		targets.forEach(el => observer.observe(el));
	});
})();






// Iframe-based popups wiring
(function () {
	const overlay = document.getElementById('popup-iframe-overlay');
	const iframe = document.getElementById('popup-iframe');
	const closeBtn = document.getElementById('popup-iframe-close');
	if (!overlay || !iframe || !closeBtn) return;

	function openPopup(n) {
		const num = String(n).trim();
		iframe.src = 'popups/popups.html?open=' + encodeURIComponent(num);
		overlay.classList.add('show');
		overlay.setAttribute('aria-hidden', 'false');
		// prevent background scroll drag while popup is open
		document.body.style.overflow = 'hidden';
		// Flag overlay active and pause main-page videos immediately
		try { window._overlayActive = true; } catch (e) { }
		try { if (window.pauseAllMainVideos) window.pauseAllMainVideos(); } catch (e) { }
	}

	function closePopup() {
		overlay.classList.remove('show');
		overlay.setAttribute('aria-hidden', 'true');
		// unload the iframe to stop any media
		iframe.src = '';
		document.body.style.overflow = '';
		// Ensure all main-page videos are stopped and reset
		try { window._overlayActive = false; } catch (e) { }
		try { if (window.stopAllMainVideos) window.stopAllMainVideos(); } catch (e) { }
		try { if (window.playVisibleMainVideos) requestAnimationFrame(() => window.playVisibleMainVideos()); } catch (e) { }
	}

	// Attach handlers to any .popup-btn buttons
	const btns = Array.from(document.querySelectorAll('.popup-btn'));
	btns.forEach(btn => {
		btn.addEventListener('click', (e) => {
			e.preventDefault();
			// derive number from id like openBtn, openBtn2, etc.
			const id = btn.id || '';
			let num = id.replace(/^[^0-9]*/, '');
			if (!num) num = '1';
			openPopup(num);
		});
	});

	// Delegate for custom-scrollbar popup buttons created dynamically
	const csButtonsContainer = document.getElementById('cs-popup-buttons');
	if (csButtonsContainer) {
		// Prevent the track from reacting (click/drag) when interacting with popup buttons
		csButtonsContainer.addEventListener('pointerdown', (e) => {
			const t = e.target;
			if (t && t.matches && t.matches('button')) {
				e.stopPropagation();
			}
		});
		csButtonsContainer.addEventListener('click', (e) => {
			const target = e.target;
			if (target && target.matches('button')) {
				e.stopPropagation();
				e.preventDefault();
				let num = '1';
				const modalAttr = target.getAttribute('data-modal') || '';
				const m = modalAttr.match(/popupModal(\d+)/);
				if (m && m[1]) num = m[1];
				else {
					const t = (target.textContent || '').match(/(\d+)/);
					if (t && t[1]) num = t[1];
				}
				openPopup(num);
			}
		});
	}

	// Close interactions
	closeBtn.addEventListener('click', closePopup);
	overlay.addEventListener('click', (e) => { if (e.target === overlay) closePopup(); });
	window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('show')) closePopup(); });
})();

// YouTube embeds: remove player UI, add minimal icon controls, autoplay when mostly visible
(function () {
	document.addEventListener('DOMContentLoaded', () => {
		const embeds = Array.from(document.querySelectorAll('.yt-embed'));
		if (!embeds.length) return;

		// load YT Iframe API once
		if (!document.querySelector('script[src*="/iframe_api"]')) {
			const s = document.createElement('script');
			s.src = 'https://www.youtube.com/iframe_api';
			document.head.appendChild(s);
		}

		const players = new Map();

		// Expose players and helpers globally to manage playback when overlay popups are shown
		try { window._mainYTPlayers = players; } catch (e) { }
		try {
			window.pauseAllMainVideos = function () {
				players.forEach(p => { try { if (p.pauseVideo) p.pauseVideo(); } catch (e) { } });
			};
			window.stopAllMainVideos = function () {
				players.forEach(p => {
					try { if (p.pauseVideo) p.pauseVideo(); } catch (e) { }
					try { if (p.seekTo) p.seekTo(0, true); } catch (e) { }
				});
			};
			window.playVisibleMainVideos = function () {
				function isMostlyVisible(el) {
					if (!el) return false;
					const rect = el.getBoundingClientRect();
					const vw = window.innerWidth || document.documentElement.clientWidth;
					const vh = window.innerHeight || document.documentElement.clientHeight;
					const interW = Math.max(0, Math.min(rect.right, vw) - Math.max(rect.left, 0));
					const interH = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
					const interArea = interW * interH;
					const area = Math.max(1, rect.width * rect.height);
					return (interArea / area) >= 0.6;
				}
				players.forEach((p, id) => {
					try {
						const iframe = document.getElementById(id);
						const section = iframe ? (iframe.closest('.frame') || iframe) : null;
						if (!section) return;
						if (isMostlyVisible(section)) {
							if (p.unMute) p.unMute();
							if (p.setVolume) p.setVolume(100);
							if (p.playVideo) p.playVideo();
						}
					} catch (e) { }
				});
			};
		} catch (e) { }

		function icon(name) {
			if (name === 'play') return '<svg class="yt-icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
			if (name === 'pause') return '<svg class="yt-icon" viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';
			if (name === 'replay') return '<svg class="yt-icon" viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6a6 6 0 01-6-6H4a8 8 0 008 8 8 8 0 000-16z"/></svg>';
			if (name === 'volume_on') return '<svg class="yt-icon" viewBox="0 0 24 24"><path d="M3 10v4h4l5 5V5L7 10H3z"/><path d="M14.5 8.5a5.5 5.5 0 010 7" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
			if (name === 'volume_off') return '<svg class="yt-icon" viewBox="0 0 24 24"><path d="M3 10v4h4l5 5V5L7 10H3z"/><path d="M5 5l14 14" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
			return '';
		}

		// add controls overlay per frame that has an embed
		function addControls(iframe) {
			const section = iframe.closest('.frame') || document.body;
			const overlay = document.createElement('div');
			overlay.className = 'yt-controls';
			overlay.dataset.target = iframe.id || '';
			overlay.innerHTML = '<button class="yt-btn" aria-label="Play">' + icon('play') + '</button>' +
				'<button class="yt-btn" aria-label="Pause">' + icon('pause') + '</button>' +
				'<button class="yt-btn" aria-label="Replay">' + icon('replay') + '</button>' +
				'<button class="yt-btn" aria-label="Mute">' + icon('volume_on') + '</button>';
			section.appendChild(overlay);
			const [playBtn, pauseBtn, replayBtn, soundBtn] = overlay.querySelectorAll('.yt-btn');
			playBtn.addEventListener('click', () => { const p = players.get(iframe.id); if (p && p.playVideo) p.playVideo(); });
			pauseBtn.addEventListener('click', () => { const p = players.get(iframe.id); if (p && p.pauseVideo) p.pauseVideo(); });
			replayBtn.addEventListener('click', () => { const p = players.get(iframe.id); if (p && p.seekTo) { p.seekTo(0, true); if (p.playVideo) p.playVideo(); } });
			soundBtn.addEventListener('click', () => {
				const p = players.get(iframe.id);
				if (!p) return;
				try {
					if (p.isMuted && p.isMuted()) { if (p.unMute) p.unMute(); if (p.setVolume) p.setVolume(100); }
					else { if (p.mute) p.mute(); }
					// Update icon state
					try {
						if (p.isMuted && p.isMuted()) { soundBtn.setAttribute('aria-label', 'Unmute'); soundBtn.innerHTML = icon('volume_off'); }
						else { soundBtn.setAttribute('aria-label', 'Mute'); soundBtn.innerHTML = icon('volume_on'); }
					} catch (e) { }
					// Ensure playback (user gesture) for sound
					if (p.playVideo) p.playVideo();
				} catch (e) { }
			});
		}

		// ensure id and add controls
		embeds.forEach((iframe, idx) => { if (!iframe.id) iframe.id = 'yt-embed-' + (idx + 1); addControls(iframe); });

		// Prevent context menu (right-click) on sections hosting videos to avoid YouTube menu
		embeds.forEach((iframe) => {
			const section = iframe.closest('.frame') || iframe.parentElement;
			if (section) {
				section.addEventListener('contextmenu', (e) => { e.preventDefault(); });
			}
		});

		// observe frames for mostly visibility (play/pause)
		const observer = new IntersectionObserver((entries) => {
			entries.forEach(entry => {
				const section = entry.target;
				const iframe = section.querySelector('.yt-embed');
				if (!iframe) return;
				const p = players.get(iframe.id);
				if (!p) return;
				// If overlay popup is active, always pause to avoid background audio
				if (window._overlayActive) { try { p.pauseVideo(); } catch (e) { } return; }
				if (entry.intersectionRatio >= 0.6) {
					try {
						// Attempt to ensure audio is on when visible for all embeds
						if (p.unMute) p.unMute();
						if (p.setVolume) p.setVolume(100);
						if (p.playVideo) p.playVideo();
					} catch (e) { }
				}
				else { try { p.pauseVideo(); } catch (e) { } }
			});
		}, { threshold: [0, 0.6] });

		const sections = new Set();
		embeds.forEach(iframe => { const s = iframe.closest('.frame'); if (s && !sections.has(s)) { sections.add(s); observer.observe(s); } });

		function initPlayers() {
			embeds.forEach(iframe => {
				try {
					const p = new YT.Player(iframe.id, {
						events: {
							onReady: (ev) => {
								try {
									// Enable audio by default for all embeds
									if (ev.target.unMute) ev.target.unMute();
									if (ev.target.setVolume) ev.target.setVolume(100);
								} catch (e) { }
							}
						}
					});
					players.set(iframe.id, p);
				} catch (e) { }
			});
		}

		const prev = window.onYouTubeIframeAPIReady;
		window.onYouTubeIframeAPIReady = function () { if (typeof prev === 'function') { try { prev(); } catch (e) { } } initPlayers(); };
	});
})();

