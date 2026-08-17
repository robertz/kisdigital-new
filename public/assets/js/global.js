"use strict";

const DTGlobal = function() {

	let ts_interval
	let ptrInstalled = false
	let swipeInstalled = false
	let activeCommentSort = 'top'

	const historyHandler = () => {
		let hist = window.dismal.h || ''
		if(hist.length)	window.history.replaceState({}, '', hist)
	}

	const showtime = () => {
		let displays = [... document.querySelectorAll('[data-ts]')]
		displays.forEach(ele => {
			ele.textContent = new moment.unix(ele.dataset.ts).fromNow()
			ele.title = new moment.unix(ele.dataset.ts).local().format('dddd, MMMM Do YYYY, h:mm:ss a')
		})

		ts_interval = window.setInterval(() => {
			let displays = [... document.querySelectorAll('[data-ts]')]
			displays.forEach(ele => {
				ele.textContent = new moment.unix(ele.dataset.ts).fromNow()
			})
		}, 60000)
	}

	const forumSelectHandler = () => {
		let selector = document.getElementById('forum-select')
		if(!selector) return

		selector.addEventListener('change', (e) => {
			window.location = e.target.value
		})

	}

	const resetTimeDisplays = () => {
		clearInterval(ts_interval)
		showtime()
	}

	const pullToRefreshHandler = () => {
		// Lightweight pull-to-refresh for touch devices.
		// Only triggers when a downward pull starts from scrollY == 0.

		if(ptrInstalled) return
		ptrInstalled = true

		const PTR_THRESHOLD = 86
		const PTR_MAX = 140

		const isInteractiveElementFocused = () => {
			const ae = document.activeElement
			if(!ae) return false
			const tag = (ae.tagName || '').toLowerCase()
			return tag === 'input' || tag === 'textarea' || tag === 'select' || ae.isContentEditable
		}

		const ensureStyles = () => {
			if(document.getElementById('ptr-style')) return
			const style = document.createElement('style')
			style.id = 'ptr-style'
			style.textContent =
				'#ptr-indicator{' +
				'position:fixed;top:0;left:0;right:0;height:52px;' +
				'display:flex;align-items:center;justify-content:center;gap:10px;' +
				'font:600 12px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;' +
				'color:#f1f1f1;background:rgba(20,20,20,.90);backdrop-filter:saturate(160%) blur(10px);' +
				'z-index:9999;transform:translateY(-60px);transition:transform 140ms ease, opacity 140ms ease;' +
				'opacity:0;pointer-events:none;}' +
				'#ptr-indicator.ptr-visible{opacity:1}' +
				'#ptr-indicator .ptr-spinner{' +
				'width:16px;height:16px;border-radius:50%;border:2px solid rgba(255,255,255,.30);' +
				'border-top-color:rgba(255,255,255,.95);animation:ptr-spin 900ms linear infinite;display:none;}' +
				'#ptr-indicator.ptr-refreshing .ptr-spinner{display:inline-block}' +
				'#ptr-indicator .ptr-arrow{' +
				'width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;' +
				'border-top:10px solid rgba(255,255,255,.95);transform:rotate(180deg);' +
				'transition:transform 140ms ease, opacity 140ms ease;}' +
				'#ptr-indicator.ptr-ready .ptr-arrow{transform:rotate(0deg)}' +
				'#ptr-indicator.ptr-refreshing .ptr-arrow{opacity:0}' +
				'@keyframes ptr-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}'
			document.head.appendChild(style)
		}

		const ensureIndicator = () => {
			let el = document.getElementById('ptr-indicator')
			if(el) return el
			el = document.createElement('div')
			el.id = 'ptr-indicator'
			const spinner = document.createElement('span')
			spinner.className = 'ptr-spinner'
			const arrow = document.createElement('span')
			arrow.className = 'ptr-arrow'
			const text = document.createElement('span')
			text.className = 'ptr-text'
			text.textContent = 'Pull to refresh'
			el.append(spinner, arrow, text)
			document.body.prepend(el)
			return el
		}

		const state = {
			tracking: false,
			startY: 0,
			pull: 0,
			refreshing: false
		}

		const setIndicator = (indicator, mode, pullPx) => {
			indicator.classList.add('ptr-visible')
			indicator.classList.toggle('ptr-ready', mode === 'ready')
			indicator.classList.toggle('ptr-refreshing', mode === 'refreshing')

			const text = indicator.querySelector('.ptr-text')
			if(text) {
				if(mode === 'refreshing') text.textContent = 'Refreshing…'
				else if(mode === 'ready') text.textContent = 'Release to refresh'
				else text.textContent = 'Pull to refresh'
			}

			// Slide indicator in proportionally while pulling
			const y = Math.max(-60, Math.min(-60 + pullPx, 0))
			indicator.style.transform = 'translateY(' + y + 'px)'
		}

		const hideIndicator = (indicator) => {
			indicator.classList.remove('ptr-visible', 'ptr-ready', 'ptr-refreshing')
			indicator.style.transform = 'translateY(-60px)'
		}

		const beginTracking = (y) => {
			if(state.refreshing) return
			const se = document.scrollingElement || document.documentElement
			const scrollTop = (se && typeof se.scrollTop === 'number') ? se.scrollTop : window.scrollY
			if(scrollTop > 0) return
			if(isInteractiveElementFocused()) return
			state.tracking = true
			state.startY = y
			state.pull = 0
		}

		const updateTracking = (y, indicator) => {
			if(!state.tracking || state.refreshing) return
			const delta = y - state.startY
			if(delta <= 0) {
				state.pull = 0
				hideIndicator(indicator)
				return
			}

			// Ease the pull so it doesn't feel too stretchy
			const eased = Math.min(PTR_MAX, Math.round(delta * 0.55))
			state.pull = eased
			const mode = eased >= PTR_THRESHOLD ? 'ready' : 'pulling'
			setIndicator(indicator, mode, eased)
		}

		const endTracking = (indicator) => {
			if(!state.tracking) return
			state.tracking = false
			if(state.refreshing) return

			if(state.pull >= PTR_THRESHOLD) {
				state.refreshing = true
				setIndicator(indicator, 'refreshing', PTR_MAX)
				window.setTimeout(() => {
					window.location.reload()
				}, 250)
				return
			}

			hideIndicator(indicator)
		}

		ensureStyles()
		const indicator = ensureIndicator()
		hideIndicator(indicator)

		// Prefer Pointer Events when available
		const onPointerDown = (e) => {
			if(e.pointerType !== 'touch') return
			beginTracking(e.clientY)
		}
		const onPointerMove = (e) => {
			if(e.pointerType !== 'touch') return
			if(!state.tracking) return
			// Prevent native overscroll while we're pulling
			if(e.cancelable) e.preventDefault()
			updateTracking(e.clientY, indicator)
		}
		const onPointerUp = (e) => {
			if(e.pointerType !== 'touch') return
			endTracking(indicator)
		}
		const onPointerCancel = (e) => {
			if(e.pointerType !== 'touch') return
			endTracking(indicator)
		}

		const onTouchStart = (e) => {
			if(!e.touches || !e.touches.length) return
			beginTracking(e.touches[0].clientY)
		}
		const onTouchMove = (e) => {
			if(!e.touches || !e.touches.length) return
			if(!state.tracking) return
			if(e.cancelable) e.preventDefault()
			updateTracking(e.touches[0].clientY, indicator)
		}
		const onTouchEnd = () => endTracking(indicator)
		const onTouchCancel = () => endTracking(indicator)

		const supportsPointer = 'PointerEvent' in window
		if(supportsPointer) {
			document.addEventListener('pointerdown', onPointerDown, { passive: true })
			document.addEventListener('pointermove', onPointerMove, { passive: false })
			document.addEventListener('pointerup', onPointerUp, { passive: true })
			document.addEventListener('pointercancel', onPointerCancel, { passive: true })
		} else {
			document.addEventListener('touchstart', onTouchStart, { passive: true })
			document.addEventListener('touchmove', onTouchMove, { passive: false })
			document.addEventListener('touchend', onTouchEnd, { passive: true })
			document.addEventListener('touchcancel', onTouchCancel, { passive: true })
		}

	}

	const swipeBackHandler = () => {
		// Lightweight "swipe right to go back" for mobile browsers that don't have
		// native edge-swipe history navigation. We only track swipes that start
		// near the left edge to avoid hijacking regular horizontal gestures.

		if(swipeInstalled) return
		swipeInstalled = true

		const EDGE_PX = 24
		const SWIPE_THRESHOLD_PX = 90
		const VERTICAL_TOLERANCE_PX = 60
		const MAX_SWIPE_TIME_MS = 800

		const isInteractiveTarget = (target) => {
			let el = target
			// climb a few levels to account for nested elements inside buttons/links
			for(let i = 0; i < 5 && el; i++) {
				const tag = ((el.tagName || '') + '').toLowerCase()
				if(
					tag === 'input' ||
					tag === 'textarea' ||
					tag === 'select' ||
					tag === 'button' ||
					tag === 'a' ||
					el.isContentEditable
				) return true
				el = el.parentElement
			}
			return false
		}

		const canGoBack = () => {
			// Some browsers always report history.length >= 1, so fall back to referrer.
			if(window.history && typeof window.history.length === 'number' && window.history.length > 1) return true
			return !!document.referrer
		}

		const goBack = () => {
			if(!canGoBack()) return
			try {
				window.history.back()
			} catch(e) {
				// last resort: navigate to referrer if available
				if(document.referrer) window.location.href = document.referrer
			}
		}

		const state = {
			tracking: false,
			startX: 0,
			startY: 0,
			startTime: 0,
			claimed: false
		}

		const start = (x, y, target) => {
			if(x > EDGE_PX) return
			if(isInteractiveTarget(target)) return
			state.tracking = true
			state.startX = x
			state.startY = y
			state.startTime = Date.now()
			state.claimed = false
		}

		const move = (x, y, e) => {
			if(!state.tracking) return false

			const dx = x - state.startX
			const dy = y - state.startY

			// Wrong direction (left swipe) -> stop tracking
			if(dx < 0) {
				state.tracking = false
				return false
			}

			// Mostly vertical gesture -> stop tracking (let scroll happen)
			if(Math.abs(dy) > VERTICAL_TOLERANCE_PX && Math.abs(dy) > Math.abs(dx)) {
				state.tracking = false
				return false
			}

			// Once it looks like a deliberate horizontal swipe, prevent default to avoid jitter.
			if(dx > 10 && !state.claimed) state.claimed = true
			if(state.claimed && e && e.cancelable) e.preventDefault()

			return dx >= SWIPE_THRESHOLD_PX && Math.abs(dy) <= VERTICAL_TOLERANCE_PX
		}

		const end = (shouldGoBack) => {
			if(!state.tracking) return
			const elapsed = Date.now() - state.startTime
			state.tracking = false
			if(shouldGoBack && elapsed <= MAX_SWIPE_TIME_MS) goBack()
		}

		// Prefer Pointer Events when available (keeps logic consistent with PTR)
		const supportsPointer = 'PointerEvent' in window

		if(supportsPointer) {
			let shouldGoBack = false

			const onPointerDown = (e) => {
				if(e.pointerType !== 'touch') return
				shouldGoBack = false
				start(e.clientX, e.clientY, e.target)
			}
			const onPointerMove = (e) => {
				if(e.pointerType !== 'touch') return
				if(!state.tracking) return
				shouldGoBack = move(e.clientX, e.clientY, e)
			}
			const onPointerUp = (e) => {
				if(e.pointerType !== 'touch') return
				end(shouldGoBack)
			}
			const onPointerCancel = (e) => {
				if(e.pointerType !== 'touch') return
				end(false)
			}

			document.addEventListener('pointerdown', onPointerDown, { passive: true })
			document.addEventListener('pointermove', onPointerMove, { passive: false })
			document.addEventListener('pointerup', onPointerUp, { passive: true })
			document.addEventListener('pointercancel', onPointerCancel, { passive: true })
		} else {
			let shouldGoBack = false

			const onTouchStart = (e) => {
				if(!e.touches || !e.touches.length) return
				shouldGoBack = false
				start(e.touches[0].clientX, e.touches[0].clientY, e.target)
			}
			const onTouchMove = (e) => {
				if(!e.touches || !e.touches.length) return
				if(!state.tracking) return
				shouldGoBack = move(e.touches[0].clientX, e.touches[0].clientY, e)
			}
			const onTouchEnd = () => end(shouldGoBack)
			const onTouchCancel = () => end(false)

			document.addEventListener('touchstart', onTouchStart, { passive: true })
			document.addEventListener('touchmove', onTouchMove, { passive: false })
			document.addEventListener('touchend', onTouchEnd, { passive: true })
			document.addEventListener('touchcancel', onTouchCancel, { passive: true })
		}
	}

	// ── Header scroll shadow ──────────────────────────────────────────────

	const headerScrollShadow = () => {
		const header = document.querySelector('.header')
		if (!header) return
		const update = () => header.classList.toggle('header--scrolled', window.scrollY > 4)
		window.addEventListener('scroll', update, { passive: true })
		update()
	}

	// ── Back to top button ────────────────────────────────────────────────

	const backToTopButton = () => {
		const btn = document.createElement('button')
		btn.className = 'dt-back-to-top'
		btn.setAttribute('aria-label', 'Back to top')
		btn.innerHTML = '<i class="bi bi-arrow-up" aria-hidden="true"></i>'
		document.body.appendChild(btn)
		window.addEventListener('scroll', () => btn.classList.toggle('dt-visible', window.scrollY > 400), { passive: true })
		btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }))
	}

	// ── Toast notifications ───────────────────────────────────────────────

	const ensureToastContainer = () => {
		let c = document.getElementById('dt-toasts')
		if (!c) {
			c = document.createElement('div')
			c.id = 'dt-toasts'
			c.className = 'dt-toasts'
			c.setAttribute('role', 'status')
			c.setAttribute('aria-live', 'polite')
			document.body.appendChild(c)
		}
		return c
	}

	const showToast = (message, type = 'info', duration = 3000) => {
		const container = ensureToastContainer()
		const toast = document.createElement('div')
		const icons = { success: 'bi-check-circle-fill', error: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' }
		toast.className = `dt-toast dt-toast--${type}`
		const icon = document.createElement('i')
		icon.className = `bi ${icons[type] || icons.info}`
		icon.setAttribute('aria-hidden', 'true')
		const msgSpan = document.createElement('span')
		msgSpan.textContent = message
		toast.appendChild(icon)
		toast.appendChild(msgSpan)
		container.appendChild(toast)
		setTimeout(() => {
			toast.classList.add('dt-toast--out')
			toast.addEventListener('animationend', () => toast.remove(), { once: true })
		}, duration)
	}

	// ── Vote pulse animation ──────────────────────────────────────────────

	const voteAnimation = () => {
		document.addEventListener('click', (e) => {
			const voteBtn = e.target.closest('[wire\\:click^="toggleVote"], [wire\\:click^="toggleCommentVote"]')
			if (!voteBtn) return
			const pill = voteBtn.closest('.c-post__vote-pill')
			const score = pill
				? pill.querySelector('.c-vote__score')
				: voteBtn.parentElement?.querySelector('.c-vote__score, .c-comment__vote-score')
			if (!score) return
			score.classList.remove('c-vote__score--pulse')
			void score.offsetWidth
			score.classList.add('c-vote__score--pulse')
			score.addEventListener('animationend', () => score.classList.remove('c-vote__score--pulse'), { once: true })
		})
	}

	// ── Keyboard shortcuts ────────────────────────────────────────────────

	const keyboardShortcuts = () => {
		let currentPostIndex = -1

		const isInputActive = () => {
			const ae = document.activeElement
			if (!ae) return false
			const tag = (ae.tagName || '').toLowerCase()
			return tag === 'input' || tag === 'textarea' || tag === 'select' || ae.isContentEditable
		}

		const getPosts = () => [...document.querySelectorAll('.c-feed-post')]

		const navigateToPost = (idx) => {
			const posts = getPosts()
			if (!posts.length) return
			currentPostIndex = Math.max(0, Math.min(idx, posts.length - 1))
			const post = posts[currentPostIndex]
			post.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
		}

		document.addEventListener('keydown', (e) => {
			if (isInputActive()) return
			if (e.metaKey || e.ctrlKey || e.altKey) return
			if (e.key === 'j') {
				e.preventDefault()
				navigateToPost(currentPostIndex < 0 ? 0 : currentPostIndex + 1)
			}
			if (e.key === 'k') {
				e.preventDefault()
				if (currentPostIndex > 0) navigateToPost(currentPostIndex - 1)
			}
			if (e.key === '?') {
				showToast('j / k — next / prev post', 'info', 4000)
			}
		})
	}

	// ── Draft auto-save ───────────────────────────────────────────────────

	const draftAutoSave = () => {
		const DRAFT_KEY = 'dt-draft-editor'
		let saveTimer = null

		const restore = () => {
			const ta = document.getElementById('editor_body')
			if (!ta || ta.value.trim().length > 0) return
			const draft = localStorage.getItem(DRAFT_KEY)
			if (!draft) return
			ta.value = draft
			ta.dispatchEvent(new Event('input', { bubbles: true }))
			showToast('Draft restored', 'info')
		}

		document.addEventListener('input', (e) => {
			if (e.target.id !== 'editor_body') return
			clearTimeout(saveTimer)
			saveTimer = setTimeout(() => {
				const val = e.target.value.trim()
				if (val) localStorage.setItem(DRAFT_KEY, e.target.value)
				else localStorage.removeItem(DRAFT_KEY)
			}, 1000)
		})

		document.addEventListener('livewire:navigate', () => {
			localStorage.removeItem(DRAFT_KEY)
		})

		restore()
	}

	// ── Feed density toggle ───────────────────────────────────────────────

	const densityToggleInit = () => {
		if (localStorage.getItem('dt-compact') !== '1') return
		document.body.classList.add('feed--compact')
		const btn = document.getElementById('feed-density-toggle')
		if (btn) btn.classList.add('active')
	}

	const toggleDensity = (btn) => {
		const compact = document.body.classList.toggle('feed--compact')
		localStorage.setItem('dt-compact', compact ? '1' : '0')
		if (btn) btn.classList.toggle('active', compact)
	}

	// ── Comment collapse ──────────────────────────────────────────────────

	const toggleComment = (btn) => {
		const article = btn.closest('.c-comment')
		if (!article) return
		const collapsed = article.classList.toggle('c-comment--collapsed')
		btn.textContent = collapsed ? '+' : '-'
		btn.setAttribute('aria-label', collapsed ? 'Expand comment thread' : 'Collapse comment thread')
	}

	// ── Comment sort ──────────────────────────────────────────────────────

	// Wilson score lower bound (95% confidence).
	// Balances approval rate with vote count — avoids promoting
	// highly-voted but divisive comments over lightly-voted but
	// universally-liked ones.
	const wilsonScore = (up, down) => {
		const n = up + down
		if (n === 0) return 0
		const z = 1.96
		const p = up / n
		return (p + z*z/(2*n) - z * Math.sqrt((p*(1-p) + z*z/(4*n))/n)) / (1 + z*z/n)
	}

	const applySortToThread = (sortType) => {
		const thread = document.querySelector('.c-comments__thread')
		if (!thread) return
		const wrappers = [...thread.querySelectorAll(':scope > .c-comment__wrapper')]
		wrappers.sort((a, b) => {
			if (sortType === 'new') {
				return parseInt(b.dataset.sortTs || '0', 10) - parseInt(a.dataset.sortTs || '0', 10)
			}
			if (sortType === 'old') {
				return parseInt(a.dataset.sortTs || '0', 10) - parseInt(b.dataset.sortTs || '0', 10)
			}
			// best: Wilson score descending, then newest first as tiebreaker
			const wA = wilsonScore(parseInt(a.dataset.sortUp || '0', 10), parseInt(a.dataset.sortDown || '0', 10))
			const wB = wilsonScore(parseInt(b.dataset.sortUp || '0', 10), parseInt(b.dataset.sortDown || '0', 10))
			return wB !== wA ? wB - wA : parseInt(b.dataset.sortTs || '0', 10) - parseInt(a.dataset.sortTs || '0', 10)
		})
		wrappers.forEach(w => thread.appendChild(w))
	}

	const updateSortButtons = (sortType) => {
		const sortBar = document.querySelector('.c-comments__sort')
		if (!sortBar) return
		sortBar.querySelectorAll('.c-comments__sort-btn').forEach(b => {
			b.classList.toggle('c-comments__sort-btn--active', b.dataset.sort === sortType)
		})
	}

	const sortComments = (btn) => {
		const sortType = btn.dataset.sort || 'top'
		activeCommentSort = sortType
		updateSortButtons(sortType)
		applySortToThread(sortType)
	}

	// ── Character counter ─────────────────────────────────────────────────

	const charCounter = () => {
		const updateCounter = (ta) => {
			let counter = ta.parentNode?.querySelector('.editor-char-count[data-for="' + ta.id + '"]')
			if (!counter) {
				counter = document.createElement('div')
				counter.className = 'editor-char-count'
				if (ta.id) counter.dataset.for = ta.id
				ta.insertAdjacentElement('afterend', counter)
			}
			const len = ta.value.length
			counter.textContent = len > 0 ? len + ' characters' : ''
			counter.classList.toggle('editor-char-count--warn', len > 5000)
		}

		document.addEventListener('input', (e) => {
			const ta = e.target
			if (ta.tagName.toLowerCase() !== 'textarea') return
			if (!ta.classList.contains('editor-textarea') && !ta.classList.contains('c-comments__textarea')) return
			updateCounter(ta)
		})
	}

	// ── Markdown toolbar ──────────────────────────────────────────────────

	const markdownToolbar = () => {
		let lastFocusedTextarea = null

		document.addEventListener('focus', (e) => {
			if (e.target.tagName.toLowerCase() === 'textarea') lastFocusedTextarea = e.target
		}, true)

		document.addEventListener('click', (e) => {
			const btn = e.target.closest('.editor-toolbar-btn')
			if (!btn) return
			e.preventDefault()

			const editorWrap = btn.closest('.editor-wrap, .c-comments__editor, .c-comment__reply, .c-comment__edit-form')
			const ta = editorWrap ? editorWrap.querySelector('textarea') : lastFocusedTextarea
			if (!ta) return

			const action = btn.dataset.mdAction
			const start = ta.selectionStart
			const end = ta.selectionEnd
			const selected = ta.value.substring(start, end)

			const wrap = (before, after, placeholder) => {
				const text = selected || placeholder
				ta.value = ta.value.substring(0, start) + before + text + after + ta.value.substring(end)
				ta.selectionStart = start + before.length
				ta.selectionEnd = start + before.length + text.length
				ta.focus()
				ta.dispatchEvent(new Event('input', { bubbles: true }))
			}

			const wrapLine = (prefix, placeholder) => {
				const text = selected || placeholder
				const newText = '\n' + prefix + text
				ta.value = ta.value.substring(0, start) + newText + ta.value.substring(end)
				ta.selectionStart = start + prefix.length + 1
				ta.selectionEnd = ta.selectionStart + text.length
				ta.focus()
				ta.dispatchEvent(new Event('input', { bubbles: true }))
			}

			if (action === 'bold')   wrap('**', '**', 'bold text')
			if (action === 'italic') wrap('_', '_', 'italic text')
			if (action === 'code')   wrap('`', '`', 'code')
			if (action === 'link')   wrap('[', selected ? '](url)' : '](url)', selected ? '' : 'link text')
			if (action === 'quote')  wrapLine('> ', 'quoted text')
			if (action === 'strike') wrap('~~', '~~', 'strikethrough')
		})
	}

	// ── Re-apply comment sort after cbwire re-renders ─────────────────────

	const commentSortPersist = () => {
		document.addEventListener('livewire:updated', () => {
			if (activeCommentSort && activeCommentSort !== 'top') {
				applySortToThread(activeCommentSort)
				updateSortButtons(activeCommentSort)
			}
		})
		document.addEventListener('livewire:navigate', () => {
			activeCommentSort = 'top'
		})
	}

	// init
	return {
		init: function() {
			historyHandler()
			showtime()
			forumSelectHandler()
			pullToRefreshHandler()
			swipeBackHandler()
			headerScrollShadow()
			backToTopButton()
			voteAnimation()
			keyboardShortcuts()
			draftAutoSave()
			densityToggleInit()
			charCounter()
			markdownToolbar()
			commentSortPersist()
		},
		resetTime: function() {
			resetTimeDisplays()
		},
		toast: function(message, type, duration) {
			showToast(message, type, duration)
		},
		toggleComment: function(btn) {
			toggleComment(btn)
		},
		sortComments: function(btn) {
			sortComments(btn)
		},
		toggleDensity: function(btn) {
			toggleDensity(btn)
		}
	}
}();

document.addEventListener('DOMContentLoaded', function() {
	DTGlobal.init()
})

// Keyboard activation for span-based interactive controls (role="button")
document.addEventListener('keydown', function(e) {
	if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"]')) {
		e.preventDefault()
		e.target.click()
	}
})

document.addEventListener('click', function(e) {
	var container = document.getElementById('notif-container')
	if (container && !container.contains(e.target)) {
		var dropdown = container.querySelector('.header-notif__dropdown')
		if (dropdown) {
			Livewire.dispatch('closeNotifications')
		}
	}
})

