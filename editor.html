<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cold Winters | Contributor Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#09090b] text-white font-sans antialiased min-h-screen">

  <!-- LOGIN OVERLAY -->
  <div id="login-modal" class="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
    <div class="bg-[#121212] border border-[#27272a] rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
      <div class="text-center space-y-1">
        <h2 class="text-xl font-extrabold text-purple-400 tracking-wide">Contributor Login</h2>
        <p class="text-xs text-zinc-500">Access database management tools</p>
      </div>
      <div id="login-error" class="hidden text-xs text-pink-500 font-medium text-center bg-pink-500/10 py-1.5 rounded-lg border border-pink-500/20"></div>
      <input id="login-user" type="text" placeholder="Username" class="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500">
      <input id="login-pass" type="password" placeholder="Password" class="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500">
      <button onclick="handleLogin()" class="w-full bg-purple-600 hover:bg-purple-700 font-bold py-2.5 rounded-lg text-sm transition-all shadow-lg shadow-purple-900/30">Sign In</button>
    </div>
  </div>

  <!-- DASHBOARD CONTAINER -->
  <div class="max-w-7xl mx-auto p-6 space-y-6">
    
    <!-- TOP HEADER -->
    <header class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e1e1e] pb-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-800 flex items-center justify-center font-extrabold italic text-white text-xs tracking-wider shadow-lg shadow-purple-900/30">CW</div>
        <div>
          <h1 class="text-xl font-bold text-white tracking-wide">Cold Winters Operations</h1>
          <p class="text-xs text-zinc-400">Database & Portal Management System</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full font-medium">● System Online</span>
        <a href="/" class="text-xs text-zinc-300 hover:text-white bg-[#18181b] px-3.5 py-2 rounded-xl border border-[#27272a] transition-all">Back to Site ←</a>
      </div>
    </header>

    <!-- NAVIGATION TABS -->
    <div class="flex gap-2 border-b border-[#1e1e1e] pb-2">
      <button id="tab-songs-btn" onclick="switchTab('songs')" class="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white transition-all">Manage Tracks</button>
      <button id="tab-news-btn" onclick="switchTab('news')" class="px-4 py-2 rounded-xl text-xs font-bold bg-[#121212] text-zinc-400 hover:text-white border border-[#27272a] transition-all">News & Alerts</button>
    </div>

    <!-- TAB 1: MANAGE SONGS -->
    <section id="section-songs" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- ADD SONG FORM -->
      <form id="song-form" onsubmit="addSong(event)" class="bg-[#121212] border border-[#1e1e1e] rounded-2xl p-5 space-y-4 h-fit shadow-xl">
        <div class="border-b border-[#1e1e1e] pb-2">
          <h3 class="text-sm font-bold text-purple-400 uppercase tracking-wider">Publish New Track</h3>
          <p class="text-[11px] text-zinc-500">Insert metadata and files directly into MongoDB Atlas</p>
        </div>
        
        <div class="space-y-2">
          <input id="song-title" type="text" placeholder="Song Title *" required class="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500">
          <input id="song-artist" type="text" placeholder="Primary Artist *" value="Juice WRLD" required class="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500">
          <input id="song-featured" type="text" placeholder="Featured Artists (e.g. Trippie Redd, Polo G)" class="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500">
          
          <label class="block text-[11px] font-semibold text-zinc-400 pt-1">Era Selection</label>
          <select id="song-era" class="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500">
            <option value="PRE">JuiceTheKidd / Pre-Juice Era (Pre-2017)</option>
            <option value="GBGR">Goodbye & Good Riddance / 999 Era (2017-2018)</option>
            <option value="DRFL">Death Race For Love Era (2018-2019)</option>
            <option value="JW3" selected>JW3 / Outsiders Era (2019)</option>
            <option value="LND">Legends Never Die Era</option>
            <option value="FD">Fighting Demons Era</option>
          </select>
        </div>

        <div class="border-t border-[#1e1e1e] pt-3 space-y-2">
          <span class="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Production Credits</span>
          <input id="song-producers" type="text" placeholder="Producer(s) (e.g. Nick Mira, DT)" class="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500">
          <input id="song-engineers" type="text" placeholder="Engineers / Mixers" class="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500">
          <div class="grid grid-cols-2 gap-2">
            <input id="song-rec-date" type="text" placeholder="Recording Date" class="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500">
            <input id="song-location" type="text" placeholder="Studio Location" class="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500">
          </div>
        </div>

        <div class="border-t border-[#1e1e1e] pt-3 space-y-2">
          <span class="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Media Files</span>
          <div>
            <label class="block text-[10px] text-zinc-500">Audio (.mp3 / .wav file)</label>
            <input id="song-audio-file" type="file" accept="audio/*" class="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-2 py-1 text-xs text-zinc-400">
            <input id="song-audio-url" type="url" placeholder="or Direct Link URL" class="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-1.5 text-xs text-white mt-1 focus:outline-none focus:border-purple-500">
          </div>
          <div>
            <label class="block text-[10px] text-zinc-500">Cover Art Image</label>
            <input id="song-cover-file" type="file" accept="image/*" class="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-2 py-1 text-xs text-zinc-400">
            <input id="song-cover-url" type="url" placeholder="or Direct Link URL" class="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-1.5 text-xs text-white mt-1 focus:outline-none focus:border-purple-500">
          </div>
        </div>

        <button type="submit" id="submit-song-btn" class="w-full bg-purple-600 hover:bg-purple-700 text-xs font-bold py-2.5 rounded-xl transition-all shadow-md">Publish Track to Database</button>
      </form>

      <!-- TRACK LIST DISPLAY -->
      <div class="lg:col-span-2 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-bold text-zinc-400 uppercase tracking-wider">Database Track List</h3>
          <span id="track-count" class="text-xs text-purple-400 font-bold bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20">0 Tracks Loaded</span>
        </div>
        <div id="songs-list" class="space-y-2 max-h-[750px] overflow-y-auto pr-1"></div>
      </div>
    </section>

    <!-- TAB 2: NEWS & ALERTS -->
    <section id="section-news" class="hidden grid grid-cols-1 lg:grid-cols-3 gap-6">
      <form id="news-form" onsubmit="addNews(event)" class="bg-[#121212] border border-[#1e1e1e] rounded-2xl p-5 space-y-4 h-fit shadow-xl">
        <div class="border-b border-[#1e1e1e] pb-2">
          <h3 class="text-sm font-bold text-purple-400 uppercase tracking-wider">Create News / Alert</h3>
          <p class="text-[11px] text-zinc-500">Publish changelogs & trigger bell notifications</p>
        </div>

        <input id="news-version" type="text" placeholder="Version (e.g., v1.5.0)" required class="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white">
        <input id="news-title" type="text" placeholder="Update Title" required class="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white">
        <input id="news-group" type="text" placeholder="Header Group (e.g., Unreleased Drops)" required class="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white">
        <textarea id="news-summary" placeholder="Summary" required class="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white h-20"></textarea>
        <textarea id="news-changes" placeholder="Key Changes (Comma Separated)" required class="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white h-20"></textarea>
        
        <div class="flex items-center gap-2 pt-1">
          <input id="news-notify" type="checkbox" class="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-purple-600 focus:ring-0">
          <label for="news-notify" class="text-xs text-pink-400 font-bold">Push Notification Alert to Bell Badge</label>
        </div>

        <button type="submit" class="w-full bg-purple-600 hover:bg-purple-700 text-xs font-bold py-2.5 rounded-xl">Publish News Post</button>
      </form>

      <div class="lg:col-span-2 space-y-3">
        <h3 class="text-sm font-bold text-zinc-400 uppercase tracking-wider">Active News Posts</h3>
        <div id="news-list" class="space-y-2"></div>
      </div>
    </section>

  </div>

  <!-- EDIT SONG MODAL -->
  <div id="edit-modal-backdrop" class="fixed inset-0 bg-black/80 backdrop-blur-md z-50 opacity-0 pointer-events-none transition-opacity duration-300 flex items-center justify-center p-4">
    <div id="edit-modal-panel" class="bg-[#121212] border border-[#27272a] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
      <button onclick="closeEditModal()" class="absolute top-4 right-4 text-zinc-400 hover:text-white font-bold">✕</button>
      
      <div class="border-b border-[#1e1e1e] pb-2">
        <h3 class="text-base font-bold text-purple-400">Edit Song Metadata</h3>
        <p class="text-xs text-zinc-500">Update track details in MongoDB Atlas</p>
      </div>

      <form id="edit-song-form" onsubmit="saveSongEdit(event)" class="space-y-3">
        <input id="edit-song-id" type="hidden">
        
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[10px] text-zinc-400">Title</label>
            <input id="edit-title" type="text" required class="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-1.5 text-xs text-white">
          </div>
          <div>
            <label class="text-[10px] text-zinc-400">Primary Artist</label>
            <input id="edit-artist" type="text" required class="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-1.5 text-xs text-white">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[10px] text-zinc-400">Featured Artists</label>
            <input id="edit-featured" type="text" class="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-1.5 text-xs text-white">
          </div>
          <div>
            <label class="text-[10px] text-zinc-400">Era</label>
            <select id="edit-era" class="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-1.5 text-xs text-white">
              <option value="PRE">JuiceTheKidd / Pre-Juice</option>
              <option value="GBGR">Goodbye & Good Riddance / 999</option>
              <option value="DRFL">Death Race For Love</option>
              <option value="JW3">JW3 / Outsiders</option>
              <option value="LND">Legends Never Die</option>
              <option value="FD">Fighting Demons</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[10px] text-zinc-400">Producer(s)</label>
            <input id="edit-producers" type="text" class="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-1.5 text-xs text-white">
          </div>
          <div>
            <label class="text-[10px] text-zinc-400">Engineers</label>
            <input id="edit-engineers" type="text" class="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-1.5 text-xs text-white">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[10px] text-zinc-400">Recording Date</label>
            <input id="edit-rec-date" type="text" class="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-1.5 text-xs text-white">
          </div>
          <div>
            <label class="text-[10px] text-zinc-400">Studio Location</label>
            <input id="edit-location" type="text" class="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-1.5 text-xs text-white">
          </div>
        </div>

        <div>
          <label class="text-[10px] text-zinc-400">Cover Art URL / Base64</label>
          <input id="edit-cover" type="text" required class="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-1.5 text-xs text-white">
        </div>

        <div>
          <label class="text-[10px] text-zinc-400">Audio Stream URL / Base64</label>
          <input id="edit-audio" type="text" required class="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-1.5 text-xs text-white">
        </div>

        <button type="submit" class="w-full bg-purple-600 hover:bg-purple-700 text-xs font-bold py-2.5 rounded-xl transition-all mt-2">Save Changes</button>
      </form>
    </div>
  </div>

  <script>
    const API = "/api";

    const fileToBase64 = file => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });

    function handleLogin() {
      const user = document.getElementById('login-user').value.trim();
      const pass = document.getElementById('login-pass').value.trim();
      const err = document.getElementById('login-error');

      fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass })
      })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          localStorage.setItem('cw_auth_token', res.token);
          document.getElementById('login-modal').classList.add('hidden');
          loadAllData();
        } else {
          err.textContent = res.message || "Invalid credentials.";
          err.classList.remove('hidden');
        }
      })
      .catch(() => {
        err.textContent = "Error connecting to backend.";
        err.classList.remove('hidden');
      });
    }

    function switchTab(tab) {
      document.getElementById('section-songs').classList.toggle('hidden', tab !== 'songs');
      document.getElementById('section-news').classList.toggle('hidden', tab !== 'news');

      document.getElementById('tab-songs-btn').className = tab === 'songs' ? "px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white transition-all" : "px-4 py-2 rounded-xl text-xs font-bold bg-[#121212] text-zinc-400 hover:text-white border border-[#27272a] transition-all";
      document.getElementById('tab-news-btn').className = tab === 'news' ? "px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white transition-all" : "px-4 py-2 rounded-xl text-xs font-bold bg-[#121212] text-zinc-400 hover:text-white border border-[#27272a] transition-all";
    }

    function loadAllData() {
      fetchSongs();
      fetchNews();
    }

    async function fetchSongs() {
      const res = await fetch(`${API}/songs`);
      const songs = await res.json();
      document.getElementById('track-count').textContent = `${songs.length} Tracks Loaded`;
      
      document.getElementById('songs-list').innerHTML = songs.map(s => `
        <div class="bg-[#121212] border border-[#1e1e1e] rounded-xl p-3 flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <img src="${s.coverArt}" class="w-10 h-10 rounded-lg object-cover">
              <div>
                <div class="font-bold text-xs text-white">${s.title} <span class="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 ml-1">${s.era}</span></div>
                <div class="text-[11px] text-zinc-400">${s.artist} ${s.producers ? `(Prod. ${s.producers})` : ''}</div>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <button onclick='openEditModal(${JSON.stringify(s)})' class="text-xs text-purple-400 hover:text-purple-300 font-bold px-2 py-1 bg-purple-500/10 rounded-lg border border-purple-500/20">Edit</button>
              <button onclick="deleteSong('${s._id}')" class="text-xs text-pink-500 hover:text-pink-400 font-bold px-2 py-1 bg-pink-500/10 rounded-lg border border-pink-500/20">Delete</button>
            </div>
          </div>
        </div>
      `).join('');
    }

    async function addSong(e) {
      e.preventDefault();
      const submitBtn = document.getElementById('submit-song-btn');
      submitBtn.textContent = 'Saving...';
      submitBtn.disabled = true;

      try {
        let finalAudioUrl = document.getElementById('song-audio-url').value;
        let finalCoverArt = document.getElementById('song-cover-url').value;

        const audioFile = document.getElementById('song-audio-file').files[0];
        const coverFile = document.getElementById('song-cover-file').files[0];

        if (audioFile) finalAudioUrl = await fileToBase64(audioFile);
        if (coverFile) finalCoverArt = await fileToBase64(coverFile);

        const body = {
          title: document.getElementById('song-title').value,
          artist: document.getElementById('song-artist').value,
          featuredArtists: document.getElementById('song-featured').value,
          era: document.getElementById('song-era').value,
          producers: document.getElementById('song-producers').value,
          engineers: document.getElementById('song-engineers').value,
          recordingDate: document.getElementById('song-rec-date').value,
          studioLocation: document.getElementById('song-location').value,
          coverArt: finalCoverArt,
          audioUrl: finalAudioUrl,
        };

        await fetch(`${API}/songs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        document.getElementById('song-form').reset();
        fetchSongs();
      } catch (err) {
        alert('Failed to save song.');
      } finally {
        submitBtn.textContent = 'Publish Track to Database';
        submitBtn.disabled = false;
      }
    }

    const editBackdrop = document.getElementById('edit-modal-backdrop');

    function openEditModal(song) {
      document.getElementById('edit-song-id').value = song._id;
      document.getElementById('edit-title').value = song.title || '';
      document.getElementById('edit-artist').value = song.artist || '';
      document.getElementById('edit-featured').value = song.featuredArtists || '';
      document.getElementById('edit-era').value = song.era || 'JW3';
      document.getElementById('edit-producers').value = song.producers || '';
      document.getElementById('edit-engineers').value = song.engineers || '';
      document.getElementById('edit-rec-date').value = song.recordingDate || '';
      document.getElementById('edit-location').value = song.studioLocation || '';
      document.getElementById('edit-cover').value = song.coverArt || '';
      document.getElementById('edit-audio').value = song.audioUrl || '';

      editBackdrop.classList.remove('opacity-0', 'pointer-events-none');
    }

    function closeEditModal() {
      editBackdrop.classList.add('opacity-0', 'pointer-events-none');
    }

    async function saveSongEdit(e) {
      e.preventDefault();
      const id = document.getElementById('edit-song-id').value;
      const body = {
        title: document.getElementById('edit-title').value,
        artist: document.getElementById('edit-artist').value,
        featuredArtists: document.getElementById('edit-featured').value,
        era: document.getElementById('edit-era').value,
        producers: document.getElementById('edit-producers').value,
        engineers: document.getElementById('edit-engineers').value,
        recordingDate: document.getElementById('edit-rec-date').value,
        studioLocation: document.getElementById('edit-location').value,
        coverArt: document.getElementById('edit-cover').value,
        audioUrl: document.getElementById('edit-audio').value,
      };

      await fetch(`${API}/songs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      closeEditModal();
      fetchSongs();
    }

    async function deleteSong(id) {
      await fetch(`${API}/songs/${id}`, { method: 'DELETE' });
      fetchSongs();
    }

    async function fetchNews() {
      const res = await fetch(`${API}/news`);
      const news = await res.json();
      document.getElementById('news-list').innerHTML = news.map(n => `
        <div class="flex items-center justify-between bg-[#121212] border border-[#1e1e1e] rounded-xl p-3">
          <div>
            <div class="font-bold text-xs text-purple-400">${n.version} - ${n.title}</div>
            <div class="text-[11px] text-zinc-400">${n.summary}</div>
          </div>
          <button onclick="deleteNews('${n._id}')" class="text-xs text-pink-500 hover:text-pink-400 font-bold px-2 py-1">Delete</button>
        </div>
      `).join('');
    }

    async function addNews(e) {
      e.preventDefault();
      const body = {
        version: document.getElementById('news-version').value,
        title: document.getElementById('news-title').value,
        group: document.getElementById('news-group').value,
        summary: document.getElementById('news-summary').value,
        changes: document.getElementById('news-changes').value.split(','),
        notifyUsers: document.getElementById('news-notify').checked
      };
      await fetch(`${API}/news`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      document.getElementById('news-form').reset();
      fetchNews();
    }

    async function deleteNews(id) {
      await fetch(`${API}/news/${id}`, { method: 'DELETE' });
      fetchNews();
    }

    if (localStorage.getItem('cw_auth_token')) {
      document.getElementById('login-modal').classList.add('hidden');
      loadAllData();
    }
  </script>
</body>
</html>
