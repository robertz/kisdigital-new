"use strict";

// Progressive enhancement for the comment/reply forms in views/posts/show.bxm
// and views/partials/commentThread.bxm — intercepts their plain
// <form method="post"> submissions and does the same create/delete over
// fetch() instead, so the comment list updates without a full page reload.
// If this script fails to load (or fetch itself fails), the forms are
// still real <form> elements pointed at routes/Comments.bx, so posting a
// comment still works via a normal page navigation.
(function(){
	function escapeAttr(value){
		return window.CSS && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, "\\$&");
	}

	function showFormError(form, message){
		var errorEl = form.querySelector(".c-comment-form__error");
		if (!errorEl) {
			errorEl = document.createElement("div");
			errorEl.className = "c-comment-form__error";
			errorEl.setAttribute("role", "alert");
			form.insertBefore(errorEl, form.firstChild);
		}
		errorEl.textContent = message;
	}

	function clearFormError(form){
		var errorEl = form.querySelector(".c-comment-form__error");
		if (errorEl) errorEl.remove();
	}

	// This route's own handlers reply with { success: false, error: "<message>" }
	// on a rejected comment. boxExpressCsrf() and boxExpressRateLimit() (both
	// mounted ahead of the route) short-circuit with their own shape instead —
	// { error: true, message: "<message>" } — so a truthy-but-non-string
	// "error" means the real text is in "message".
	function errorMessage(data){
		if (data && typeof data.error === "string" && data.error) return data.error;
		if (data && data.message) return data.message;
		return "Couldn't post your comment — please try again.";
	}

	// Places a newly-created comment's HTML at the correct spot in the flat,
	// depth-annotated list — same list order CommentService.getCommentThread()
	// produces server-side. A top-level comment (no parentId) always belongs
	// at the very end (the flat list is already sorted by created, and a new
	// top-level comment's subtree hasn't started yet). A reply belongs right
	// after its parent's own subtree — found by walking forward from the
	// parent element past every sibling deeper than it.
	function insertComment(list, html, parentId){
		var wrapper = document.createElement("div");
		wrapper.innerHTML = html.trim();
		var newEl = wrapper.firstElementChild;
		if (!newEl) return null;

		if (!parentId) {
			list.appendChild(newEl);
			return newEl;
		}

		var parentEl = list.querySelector("#comment-" + escapeAttr(parentId));
		if (!parentEl) {
			list.appendChild(newEl);
			return newEl;
		}

		var parentDepth = parseInt(parentEl.getAttribute("data-depth"), 10) || 0;
		var sibling = parentEl.nextElementSibling;
		while (sibling && (parseInt(sibling.getAttribute("data-depth"), 10) || 0) > parentDepth) {
			sibling = sibling.nextElementSibling;
		}
		list.insertBefore(newEl, sibling);
		return newEl;
	}

	// Takes the server's own getCommentCount() result rather than
	// incrementing/decrementing a client-side guess — CommentService only
	// counts status='visible' rows, and this route also rate-limits/bot-
	// filters posts that never reach here, so a locally-guessed delta could
	// drift from what a page reload would actually show.
	function setCommentCount(count){
		var label = document.querySelector("[data-comment-count-label]");
		if (!label || typeof count !== "number") return;
		label.textContent = "Comments" + (count ? " (" + count + ")" : "");
	}

	function collapseReplyForm(form){
		var details = form.closest(".c-comment__reply-toggle");
		form.reset();
		clearFormError(form);
		if (details) details.open = false;
	}

	function handleCommentFormSubmit(form){
		var list = document.querySelector("[data-comment-list]");
		var submitBtn = form.querySelector('button[type="submit"]');
		var parentId = form.getAttribute("data-parent-id") || "";

		clearFormError(form);
		if (submitBtn) submitBtn.disabled = true;

		var params = new URLSearchParams(new FormData(form));

		fetch(form.getAttribute("action"), {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"X-Requested-With": "XMLHttpRequest"
			},
			body: params.toString()
		})
			.then(function(res){ return res.json().then(function(data){ return { ok: res.ok, data: data }; }); })
			.then(function(result){
				if (!result.ok || !result.data.success) {
					showFormError(form, errorMessage(result.data));
					return;
				}

				if (list) {
					var emptyMsg = list.querySelector("[data-comment-empty]");
					if (emptyMsg) emptyMsg.setAttribute("hidden", "");
					var newEl = insertComment(list, result.data.html, parentId);
					if (newEl && window.LocalTime) window.LocalTime.apply(newEl);
				}
				setCommentCount(result.data.count);

				if (parentId) {
					collapseReplyForm(form);
				} else {
					form.reset();
				}
			})
			.catch(function(){
				showFormError(form, "Couldn't post your comment — please try again.");
			})
			.finally(function(){
				if (submitBtn) submitBtn.disabled = false;
			});
	}

	function handleDeleteFormSubmit(form){
		var comment = form.closest(".c-comment");
		var submitBtn = form.querySelector('button[type="submit"]');
		if (submitBtn) submitBtn.disabled = true;

		var params = new URLSearchParams(new FormData(form));

		fetch(form.getAttribute("action"), {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"X-Requested-With": "XMLHttpRequest"
			},
			body: params.toString()
		})
			.then(function(res){ return res.json().then(function(data){ return { ok: res.ok, data: data }; }); })
			.then(function(result){
				if (!result.ok || !result.data.success) return;
				setCommentCount(result.data.count);
				if (!comment) return;
				var bodyCol = comment.querySelector(".c-comment__body-col");
				if (bodyCol) bodyCol.innerHTML = '<p class="c-comment__deleted">[deleted]</p>';
			})
			.finally(function(){
				if (submitBtn) submitBtn.disabled = false;
			});
	}

	document.addEventListener("submit", function(event){
		var form = event.target;
		if (form.matches && form.matches("[data-comment-form]")) {
			event.preventDefault();
			handleCommentFormSubmit(form);
		} else if (form.matches && form.matches("[data-comment-delete-form]")) {
			event.preventDefault();
			handleDeleteFormSubmit(form);
		}
	});

	document.addEventListener("click", function(event){
		var cancelBtn = event.target.closest && event.target.closest("[data-comment-cancel]");
		if (cancelBtn) {
			collapseReplyForm(cancelBtn.closest("form"));
		}
	});

	// Auto-focus the reply textarea as soon as its <details> opens, same
	// convenience a native "Reply" button gives you elsewhere.
	document.addEventListener("toggle", function(event){
		var details = event.target;
		if (!details.matches || !details.matches(".c-comment__reply-toggle") || !details.open) return;
		var textarea = details.querySelector("textarea");
		if (textarea) textarea.focus();
	}, true);
})();
