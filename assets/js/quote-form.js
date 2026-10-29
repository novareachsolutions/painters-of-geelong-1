/**
 * Painters of Geelong — quote forms (home page and contact page).
 *
 * A form opts in with data attributes naming its source and its banners:
 *   <form data-quote-form data-source="home" data-success="homeFormSuccess" data-error="homeFormError">
 *
 * Fields are restricted as the user types and validated on blur and submit.
 * The rules mirror api/send-email.js, which validates everything again.
 * Photos are resized in the browser before sending, because Vercel caps a
 * function request at 4.5 MB.
 */
(function () {
  var NAME_RE = /^\p{L}+(?: \p{L}+)*$/u;
  var PHONE_RE = /^(?:0[2-478]\d{8}|\+61[2-478]\d{8})$/;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
  var SUBURB_RE = /^[\p{L}0-9' -]+$/u;
  var MAX_DETAILS = 1000;

  var PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  var MAX_PHOTOS = 5;
  var MAX_PHOTO_BYTES = 5 * 1024 * 1024;
  var PHOTO_BUDGET = 3400000; // base64 characters for the whole batch

  function validSuburb(v) {
    if (v.length < 3 || !SUBURB_RE.test(v)) return false;
    var digits = v.match(/\d+/g) || [];
    if (digits.length > 1 || (digits.length === 1 && digits[0].length !== 4)) return false;
    return /\p{L}{2,}/u.test(v) || digits.length === 1;
  }

  // Each rule returns '' when the (non-empty) value is fine, else the message.
  var RULES = {
    name: {
      required: 'Please enter your name.',
      check: function (v) {
        if (!NAME_RE.test(v)) return 'Your name can only contain letters and spaces.';
        return v.length < 2 ? 'Please enter your full name.' : '';
      }
    },
    phone: {
      required: 'Please enter your phone number.',
      check: function (v) {
        return PHONE_RE.test(v) ? '' : 'Please enter a valid Australian phone number, e.g. 0431261281 or +61431261281.';
      }
    },
    email: {
      check: function (v) {
        return v.length <= 254 && EMAIL_RE.test(v) ? '' : 'Please enter a valid email address.';
      }
    },
    suburb: {
      required: 'Please enter your suburb or postcode.',
      check: function (v) {
        return validSuburb(v) ? '' : 'Please enter a suburb name and/or a 4-digit postcode.';
      }
    },
    service: { required: 'Please choose a service.' },
    timeframe: {},
    message: {
      check: function (v) {
        return v.length <= MAX_DETAILS ? '' : 'Please keep project details under 1,000 characters.';
      }
    }
  };

  // Strip characters a field can never contain, as the user types or pastes.
  var SANITISE = {
    name: function (v) { return v.replace(/[^\p{L} ]/gu, '').replace(/^ +/, '').replace(/ {2,}/g, ' '); },
    phone: function (v) {
      var plus = v.trim().charAt(0) === '+';
      var digits = v.replace(/\D/g, '');
      if (plus) digits = digits.replace(/^610/, '61'); // +61 0431... -> +61 431...
      digits = digits.slice(0, plus ? 11 : 10);
      return (plus ? '+' : '') + digits;
    },
    email: function (v) { return v.replace(/\s/g, ''); },
    suburb: function (v) { return v.replace(/[^\p{L}0-9' -]/gu, '').replace(/^ +/, '').replace(/ {2,}/g, ' '); }
  };

  function clean(name, v) {
    v = String(v || '').trim();
    return (name === 'name' || name === 'suburb') ? v.replace(/ {2,}/g, ' ') : v;
  }

  function sanitise(el, fn) {
    var before = el.value, after = fn(before);
    if (after === before) return;
    var pos = null;
    try { pos = el.selectionStart; } catch (e) {}
    el.value = after;
    if (pos != null) {
      var keep = fn(before.slice(0, pos)).length; // caret stays after the same characters
      try { el.setSelectionRange(keep, keep); } catch (e) {}
    }
  }

  function formatSize(bytes) {
    return bytes < 1024 * 1024 ? Math.max(1, Math.round(bytes / 1024)) + ' KB' : (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  function encodePhoto(file, maxSide, quality) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        var w = Math.max(1, Math.round(img.naturalWidth * scale));
        var h = Math.max(1, Math.round(img.naturalHeight * scale));
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; // transparent PNG areas become white in the JPEG
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve({
          name: file.name.replace(/\.[^.]+$/, '') + '.jpg',
          type: 'image/jpeg',
          data: canvas.toDataURL('image/jpeg', quality).split(',')[1]
        });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
      img.src = url;
    });
  }

  function encodePhotos(files) {
    if (!files.length) return Promise.resolve([]);
    function pass(maxSide, quality) {
      return Promise.all(files.map(function (f) { return encodePhoto(f, maxSide, quality); }));
    }
    function total(list) { return list.reduce(function (n, p) { return n + p.data.length; }, 0); }
    return pass(1600, 0.8).then(function (list) {
      if (total(list) <= PHOTO_BUDGET) return list;
      return pass(1200, 0.7).then(function (smaller) {
        if (total(smaller) > PHOTO_BUDGET) throw new Error('too-large');
        return smaller;
      });
    });
  }

  function initForm(form) {
    var successEl = document.getElementById(form.getAttribute('data-success'));
    var failEl = document.getElementById(form.getAttribute('data-error'));
    var source = form.getAttribute('data-source') || '';
    var photoInput = form.querySelector('.photo-input');
    var photoDrop = form.querySelector('.photo-drop');
    var photoList = form.querySelector('.photo-list');
    var photos = []; // { file, url }

    function setError(name, message) {
      var el = form.elements[name];
      if (!el) return;
      var wrap = el.closest('.form-field');
      var err = form.querySelector('[data-error-for="' + name + '"]');
      wrap.classList.toggle('invalid', !!message);
      el.setAttribute('aria-invalid', message ? 'true' : 'false');
      if (err) err.textContent = message || '';
    }

    function validate(name) {
      var el = form.elements[name];
      if (!el) return true;
      var rule = RULES[name];
      var value = clean(name, el.value);
      var message = value ? (rule.check ? rule.check(value) : '') : (rule.required || '');
      setError(name, message);
      return !message;
    }

    function showBanner(el, msg) {
      if (!el) return;
      if (msg != null) el.textContent = msg;
      el.classList.add('show');
    }
    function hideBanners() {
      if (successEl) successEl.classList.remove('show');
      if (failEl) failEl.classList.remove('show');
    }

    // --- photos ---
    function renderPhotos() {
      if (!photoList) return;
      photoList.innerHTML = '';
      photos.forEach(function (p, i) {
        var li = document.createElement('li');
        li.className = 'photo-item';
        var img = document.createElement('img');
        img.src = p.url;
        img.alt = '';
        var name = document.createElement('span');
        name.className = 'photo-name';
        name.textContent = p.file.name;
        var size = document.createElement('span');
        size.className = 'photo-size';
        size.textContent = formatSize(p.file.size);
        var remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'photo-remove';
        remove.setAttribute('aria-label', 'Remove ' + p.file.name);
        remove.innerHTML = '&times;';
        remove.addEventListener('click', function () {
          URL.revokeObjectURL(p.url);
          photos.splice(i, 1);
          renderPhotos();
          setError('photos', '');
          photoInput.focus();
        });
        li.appendChild(img);
        li.appendChild(name);
        li.appendChild(size);
        li.appendChild(remove);
        photoList.appendChild(li);
      });
    }

    function addPhotos(fileList) {
      var problems = [];
      Array.prototype.forEach.call(fileList, function (file) {
        var msg = '';
        if (PHOTO_TYPES.indexOf(file.type) === -1) msg = file.name + ' isn’t a JPG, PNG or WebP image.';
        else if (file.size > MAX_PHOTO_BYTES) msg = file.name + ' is larger than 5 MB.';
        else if (photos.length >= MAX_PHOTOS) msg = 'You can upload up to 5 photos.';
        if (msg) { if (problems.indexOf(msg) === -1) problems.push(msg); return; }
        var dupe = photos.some(function (p) {
          return p.file.name === file.name && p.file.size === file.size && p.file.lastModified === file.lastModified;
        });
        if (!dupe) photos.push({ file: file, url: URL.createObjectURL(file) });
      });
      renderPhotos();
      setError('photos', problems.join(' '));
    }

    function clearPhotos() {
      photos.forEach(function (p) { URL.revokeObjectURL(p.url); });
      photos = [];
      renderPhotos();
    }

    if (photoInput) {
      photoInput.addEventListener('change', function () {
        addPhotos(photoInput.files);
        photoInput.value = '';
      });
      ['dragenter', 'dragover'].forEach(function (ev) {
        photoDrop.addEventListener(ev, function () { photoDrop.classList.add('is-dragging'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        photoDrop.addEventListener(ev, function () { photoDrop.classList.remove('is-dragging'); });
      });
    }

    // --- fields ---
    Object.keys(RULES).forEach(function (name) {
      var el = form.elements[name];
      if (!el) return;
      var isSelect = el.tagName === 'SELECT';
      el.addEventListener(isSelect ? 'change' : 'input', function () {
        if (SANITISE[name]) sanitise(el, SANITISE[name]);
        if (el.closest('.form-field').classList.contains('invalid')) validate(name);
      });
      el.addEventListener('blur', function () { validate(name); });
    });

    // --- submit ---
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      hideBanners();

      var firstInvalid = null;
      Object.keys(RULES).forEach(function (name) {
        if (!validate(name) && !firstInvalid) firstInvalid = form.elements[name];
      });
      if (firstInvalid) { firstInvalid.focus(); return; }

      var btn = form.querySelector('[type="submit"]');
      var btnHtml = btn ? btn.innerHTML : '';
      if (btn) { btn.disabled = true; btn.innerHTML = 'Sending…'; }

      var data = { company: form.elements.company ? form.elements.company.value : '', source: source };
      Object.keys(RULES).forEach(function (name) {
        if (form.elements[name]) data[name] = clean(name, form.elements[name].value);
      });

      encodePhotos(photos.map(function (p) { return p.file; }))
        .catch(function (err) {
          var photoErr = new Error(err && err.message === 'too-large'
            ? 'These photos are too large to send together. Please remove one or two and try again.'
            : 'One of the photos couldn’t be read. Please remove it and try again.');
          photoErr.photo = true;
          throw photoErr;
        })
        .then(function (list) {
          data.photos = list;
          return fetch(form.action, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(data)
          }).then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (j) {
              return { ok: r.ok && j.ok, error: j.error, field: j.field };
            });
          });
        })
        .then(function (res) {
          if (res.ok) {
            showBanner(successEl);
            form.reset();
            clearPhotos();
          } else {
            if (res.field && form.elements[res.field]) setError(res.field, res.error);
            showBanner(failEl, res.error || 'Sorry, something went wrong. Please call us or try again.');
          }
        })
        .catch(function (err) {
          if (err && err.photo) setError('photos', err.message);
          else showBanner(failEl, 'Network error. Please try again or call us directly.');
        })
        .then(function () {
          if (btn) { btn.disabled = false; btn.innerHTML = btnHtml; }
        });
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('form[data-quote-form]'), initForm);
})();
