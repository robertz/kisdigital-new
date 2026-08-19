"use strict";

// Shared R2 directory browsing: listing/parsing, breadcrumb + tile rendering,
// and folder creation. Used by both the media manager (views/manage/media/
// index.bxm) and the post editor's image picker (views/manage/posts/
// form.bxm) — same presign-then-fetch-directly pattern, same markup classes
// (.c-media-manager__*), just pointed at different endpoints/containers.
// Not part of the esbuild bundle (that pipeline only covers the public-facing
// site) — loaded directly like the rest of the manage pages' page-local JS.
window.MediaBrowser = (function(){
	var IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "gif"];

	function extOf(name){
		var parts = name.split(".");
		return parts.length > 1 ? parts.pop().toLowerCase() : "";
	}

	function formatSize(bytes){
		bytes = Number(bytes) || 0;
		if (bytes < 1024) return bytes + " B";
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
		return (bytes / (1024 * 1024)).toFixed(1) + " MB";
	}

	function parseListing(xmlText, path, publicBaseUrl){
		var xml = new DOMParser().parseFromString(xmlText, "application/xml");

		var folders = Array.prototype.slice.call(xml.getElementsByTagName("CommonPrefixes")).map(function(node){
			var prefix = node.getElementsByTagName("Prefix")[0].textContent;
			var name = prefix.slice(path.length).replace(/\/$/, "");
			return { prefix: prefix, name: name };
		}).filter(function(f){ return f.name.length; });

		var files = Array.prototype.slice.call(xml.getElementsByTagName("Contents")).map(function(node){
			var key = node.getElementsByTagName("Key")[0].textContent;
			var sizeNode = node.getElementsByTagName("Size")[0];
			return {
				key: key,
				name: key.slice(path.length),
				size: sizeNode ? sizeNode.textContent : 0,
				url: publicBaseUrl + "/" + key
			};
		// Drop the directory's own zero-byte marker (if any) and the ".keep"
		// placeholder objects createFolder() writes to make empty folders visible.
		}).filter(function(f){ return f.name.length && f.name !== ".keep"; });

		return { folders: folders, files: files };
	}

	function renderBreadcrumb(el, path, onNavigate){
		el.innerHTML = "";
		var rootLink = document.createElement("button");
		rootLink.type = "button";
		rootLink.className = "c-media-manager__crumb";
		rootLink.textContent = "Root";
		rootLink.addEventListener("click", function(){ onNavigate(""); });
		el.appendChild(rootLink);

		var segments = path.split("/").filter(Boolean);
		var built = "";
		segments.forEach(function(seg){
			built += seg + "/";
			var sep = document.createElement("span");
			sep.className = "c-media-manager__crumb-sep";
			sep.textContent = "/";
			el.appendChild(sep);

			var crumbPath = built;
			var link = document.createElement("button");
			link.type = "button";
			link.className = "c-media-manager__crumb";
			link.textContent = seg;
			link.addEventListener("click", function(){ onNavigate(crumbPath); });
			el.appendChild(link);
		});
	}

	// options: { onNavigateFolder(prefix), onFileClick(file, images, index), onNewFolder() }
	function renderGrid(gridEl, folders, files, options){
		gridEl.innerHTML = "";

		if (options.onNewFolder) {
			var newFolderTile = document.createElement("button");
			newFolderTile.type = "button";
			newFolderTile.className = "c-media-manager__tile c-media-manager__tile--folder c-media-manager__tile--new";
			newFolderTile.innerHTML = '<i class="bi bi-folder-plus"></i><span>New folder</span>';
			newFolderTile.addEventListener("click", options.onNewFolder);
			gridEl.appendChild(newFolderTile);
		}

		if (!folders.length && !files.length) {
			var empty = document.createElement("p");
			empty.className = "text-muted";
			empty.textContent = "This directory is empty.";
			gridEl.appendChild(empty);
			return;
		}

		folders.forEach(function(folder){
			var tile = document.createElement("button");
			tile.type = "button";
			tile.className = "c-media-manager__tile c-media-manager__tile--folder";
			tile.innerHTML = '<i class="bi bi-folder-fill"></i><span>' + folder.name + "</span>";
			tile.addEventListener("click", function(){ options.onNavigateFolder(folder.prefix); });
			gridEl.appendChild(tile);
		});

		var images = files.filter(function(f){ return IMAGE_EXT.indexOf(extOf(f.name)) !== -1; });

		files.forEach(function(file){
			var isImage = IMAGE_EXT.indexOf(extOf(file.name)) !== -1;
			var tile = document.createElement(isImage ? "button" : "a");
			if (isImage) {
				tile.type = "button";
			} else {
				tile.href = file.url;
				tile.target = "_blank";
				tile.rel = "noopener";
			}
			tile.className = "c-media-manager__tile c-media-manager__tile--file";
			tile.title = file.name;

			if (isImage) {
				var img = document.createElement("img");
				img.src = file.url;
				img.alt = file.name;
				img.loading = "lazy";
				tile.appendChild(img);
				if (options.onFileClick) {
					tile.addEventListener("click", function(){ options.onFileClick(file, images, images.indexOf(file)); });
				}
			} else {
				var icon = document.createElement("i");
				icon.className = "bi bi-file-earmark";
				tile.appendChild(icon);
			}

			var caption = document.createElement("div");
			caption.className = "c-media-manager__tile-caption";
			caption.innerHTML = "<span>" + file.name + "</span><small>" + formatSize(file.size) + "</small>";
			tile.appendChild(caption);

			gridEl.appendChild(tile);
		});
	}

	// Two-step, same as upload: the server only presigns a list URL (it never
	// fetches the listing itself), then this fetches that URL directly and
	// parses the ListBucketResult XML client-side.
	// config: { path, listUrlEndpoint, gridEl, breadcrumbEl (optional),
	//           onNavigateFolder, onFileClick (optional), onNewFolder (optional) }
	// Returns a Promise resolving to the resolved (sanitized) path.
	function loadDirectory(config){
		var gridEl = config.gridEl;
		gridEl.innerHTML = '<p class="text-muted">Loading…</p>';

		return fetch(config.listUrlEndpoint + "?path=" + encodeURIComponent(config.path), { headers: { "X-Requested-With": "XMLHttpRequest" } })
		.then(function(res){ return res.json(); })
		.then(function(data){
			if (!data.success) return Promise.reject(data.error || "Could not load this directory.");
			return fetch(data.listUrl).then(function(listRes){
				if (!listRes.ok) return Promise.reject("Could not load this directory.");
				return listRes.text().then(function(xmlText){
					return { xmlText: xmlText, publicBaseUrl: data.publicBaseUrl, path: data.path };
				});
			});
		})
		.then(function(result){
			var parsed = parseListing(result.xmlText, result.path, result.publicBaseUrl);
			if (config.breadcrumbEl) renderBreadcrumb(config.breadcrumbEl, result.path, config.onNavigateFolder);
			renderGrid(gridEl, parsed.folders, parsed.files, {
				onNavigateFolder: config.onNavigateFolder,
				onFileClick: config.onFileClick,
				onNewFolder: config.onNewFolder
			});
			return result.path;
		})
		.catch(function(err){
			gridEl.innerHTML = '<p class="text-danger">' + (typeof err === "string" ? err : "Couldn't load this directory — check your connection and try again.") + "</p>";
			return Promise.reject(err);
		});
	}

	// Prompts for a name, presigns + PUTs a zero-byte ".keep" marker under
	// it (S3-compatible storage has no real directories — an empty "folder"
	// only exists once something, even a placeholder, is stored under that
	// prefix). Resolves the new folder's path on success, or null if the
	// user cancelled/entered nothing.
	function createFolder(config){
		var name = window.prompt("New folder name:");
		if (name === null) return Promise.resolve(null);
		name = name.trim();
		if (!name) return Promise.resolve(null);

		return fetch(config.createFolderEndpoint, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded", "X-CSRF-Token": config.csrfToken },
			body: new URLSearchParams({ path: config.path, name: name })
		})
		.then(function(res){ return res.json(); })
		.then(function(data){
			if (!data.success) return Promise.reject(data.error || "Could not create the folder.");
			return fetch(data.uploadUrl, { method: "PUT", headers: { "Content-Type": "application/x-directory" }, body: "" })
			.then(function(putRes){
				if (!putRes.ok) return Promise.reject("Could not create the folder.");
				return data.path;
			});
		});
	}

	return {
		loadDirectory: loadDirectory,
		createFolder: createFolder,
		formatSize: formatSize,
		extOf: extOf,
		IMAGE_EXT: IMAGE_EXT
	};
})();
