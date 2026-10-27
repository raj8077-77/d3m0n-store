/* Custom player. No YouTube chrome. Double-tap seeks or pauses with no icons.
   Ads reload the same video id twice. No skip button. */
(function () {
  var playI = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  var pauseI = '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';

  function clock(n) {
    n = Math.max(0, Math.floor(n || 0));
    return Math.floor(n / 60) + ":" + String(n % 60).padStart(2, "0");
  }

  window.mountPlayer = function (root, videoId, endThumb) {
    if (!root || !videoId) return;
    root.innerHTML =
      '<div class="yp" id="ypShell">' +
      '<div class="yp-stage"><div class="ytbox" id="ypYt"></div></div>' +
      '<div class="yp-veil-top"></div><div class="yp-veil-bot"></div>' +
      '<div class="yp-hit" id="ypHit"></div>' +
      '<div class="yp-curtain" id="ypCurtain"><button class="yp-play" id="ypStart" type="button" aria-label="Play">' + playI + '</button></div>' +
      '<button class="yp-end off" id="ypEnd" type="button"><img alt="" src="' + (endThumb || "") + '"><span class="yp-play">' + playI + '</span></button>' +
      '<div class="yp-chrome" id="ypChrome"><div class="yp-logo">D3M0N<b>.IN</b></div>' +
      '<div class="yp-bar"><input class="yp-seek" id="ypSeek" type="range" min="0" max="1000" value="0">' +
      '<div class="yp-row"><button class="yp-ico" id="ypToggle" type="button"></button>' +
      '<span class="yp-time" id="ypTime">0:00 / 0:00</span><span class="yp-spacer"></span></div></div></div></div>';

    var player = null, hideT = null, lastTap = 0, adLock = false, adRound = 0, contentAt = 0;
    var VIDEO = videoId;

    function showChrome() {
      var c = document.getElementById("ypChrome");
      if (!c) return;
      c.classList.remove("hide");
      clearTimeout(hideT);
      if (player && player.getPlayerState && player.getPlayerState() === 1) {
        hideT = setTimeout(function () { c.classList.add("hide"); }, 2500);
      }
    }
    function paint() {
      if (!player || !player.getDuration) return;
      var d = player.getDuration() || 0, t = player.getCurrentTime() || 0, st = player.getPlayerState();
      var seek = document.getElementById("ypSeek");
      if (d && document.activeElement !== seek) seek.value = Math.floor((t / d) * 1000);
      document.getElementById("ypTime").textContent = clock(t) + " / " + clock(d);
      document.getElementById("ypToggle").innerHTML = st === 1 ? pauseI : playI;
      if (st === 0) document.getElementById("ypEnd").classList.remove("off");
      watchAd();
    }
    function videoIdNow() {
      try {
        var data = player.getVideoData ? player.getVideoData() : null;
        if (data && data.video_id) return data.video_id;
      } catch (e) {}
      return "";
    }
    function adOn() {
      var st = player && player.getPlayerState ? player.getPlayerState() : -1;
      if (st !== 1 && st !== 3) return false;
      var id = videoIdNow();
      return !!(id && id !== VIDEO);
    }
    function kickAd() {
      if (adLock || adRound >= 2 || !player || !player.loadVideoById) return;
      adLock = true;
      adRound += 1;
      try { player.loadVideoById({ videoId: VIDEO, startSeconds: contentAt || 0 }); } catch (e) {}
      setTimeout(function () { adLock = false; }, 1200);
    }
    function watchAd() {
      if (!player) return;
      if (videoIdNow() === VIDEO) { contentAt = player.getCurrentTime() || 0; adRound = 0; }
      if (adOn()) kickAd();
    }
    function boot() {
      player = new YT.Player("ypYt", {
        videoId: VIDEO,
        host: "https://www.youtube-nocookie.com",
        playerVars: { autoplay: 0, controls: 0, rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3, fs: 0 },
        events: {
          onReady: function () {
            document.getElementById("ypCurtain").classList.add("off");
            player.playVideo();
            showChrome();
          },
          onStateChange: paint
        }
      });
      setInterval(paint, 400);
    }
    function ensure() {
      document.getElementById("ypCurtain").classList.add("off");
      if (player) player.playVideo();
      else if (window.YT && YT.Player) boot();
    }
    function tap(x, w) {
      var now = Date.now();
      var z = x < w * 0.33 ? "l" : x > w * 0.67 ? "r" : "c";
      if (now - lastTap < 280 && player) {
        if (z === "l") player.seekTo(Math.max(0, player.getCurrentTime() - 10), true);
        else if (z === "r") player.seekTo(player.getCurrentTime() + 10, true);
        else player.getPlayerState() === 1 ? player.pauseVideo() : player.playVideo();
        lastTap = 0;
        return;
      }
      lastTap = now;
      document.getElementById("ypChrome").classList.toggle("hide");
    }
    document.getElementById("ypStart").onclick = function (e) { e.stopPropagation(); ensure(); };
    document.getElementById("ypEnd").onclick = function () {
      document.getElementById("ypEnd").classList.add("off");
      if (player) { player.seekTo(0, true); player.playVideo(); }
    };
    document.getElementById("ypToggle").onclick = function () {
      if (!player) return ensure();
      player.getPlayerState() === 1 ? player.pauseVideo() : player.playVideo();
      showChrome();
    };
    document.getElementById("ypSeek").oninput = function () {
      if (player && player.getDuration()) player.seekTo((this.value / 1000) * player.getDuration(), true);
    };
    document.getElementById("ypHit").onclick = function (e) {
      var box = this.getBoundingClientRect();
      tap(e.clientX - box.left, box.width);
    };
    if (window.YT && YT.Player) boot();
    else {
      window.onYouTubeIframeAPIReady = boot;
      var s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
  };
})();
