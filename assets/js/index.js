    gsap.registerPlugin(ScrollTrigger);

    // Hero entrance animation
    const heroElements = ['.hero-heading', '.hero-subtext', '.hero-buttons', '.hero-ratings'];
    gsap.set(heroElements, { opacity: 0, y: 40, x: -20 });
    gsap.set('.hero-right', { opacity: 0, x: 60 });

    heroElements.forEach((el, i) => {
      gsap.to(el, { opacity: 1, y: 0, x: 0, duration: 0.9, ease: 'power2.out', delay: 0.3 + i * 0.2 });
    });
    gsap.to('.hero-right', { opacity: 1, x: 0, duration: 1, ease: 'power2.out', delay: 0.5 });

    // Hero satisfaction counter animation
    const statEl = document.querySelector('.stat-percent[data-target]');
    if (statEl) {
      const target = parseInt(statEl.dataset.target);
      gsap.to({ val: 0 }, {
        val: target,
        duration: 2,
        delay: 1,
        ease: 'power1.out',
        onUpdate: function () {
          statEl.textContent = Math.round(this.targets()[0].val) + '%';
        }
      });
    }

    // Avatar carousel — slide left, cycle profiles
    const avatarInner = document.querySelector('.avatars-row-inner');
    if (avatarInner) {
      const avatars = avatarInner.querySelectorAll('.avatar-img');
      let avatarOffset = 0;
      const step = 26; // 36px width - 10px overlap
      setInterval(() => {
        avatarOffset += step;
        avatarInner.style.transform = `translateX(-${avatarOffset}px)`;
        setTimeout(() => {
          avatarInner.style.transition = 'none';
          avatarInner.appendChild(avatars[0].parentNode === avatarInner ? avatarInner.firstElementChild : avatarInner.children[0]);
          avatarOffset -= step;
          avatarInner.style.transform = `translateX(-${avatarOffset}px)`;
          requestAnimationFrame(() => { avatarInner.style.transition = 'transform 0.35s ease'; });
        }, 350);
      }, 1200);
    }

    // Card fan-out animation
    const cards = gsap.utils.toArray('.steps-grid .step-card, .steps-grid .step-cta');
    const grid = document.querySelector('.steps-grid');

    // Set initial stacked state — all cards piled in center with 3D rotation
    gsap.set(cards, {
      position: 'relative',
      opacity: 0,
      rotateY: -360,
      rotateX: 10,
      rotateZ: -5,
      translateZ: (i) => -40 * (cards.length - i),
      scale: 0.88,
      x: (i, el) => {
        // Calculate offset to stack all cards at center
        const gridRect = grid.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const gridCenter = gridRect.width / 2;
        const elCenter = elRect.left - gridRect.left + elRect.width / 2;
        return gridCenter - elCenter;
      },
      boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      transformPerspective: 1400,
      transformOrigin: 'center center',
    });

    // Container starts narrow, expands
    gsap.set(grid, { maxWidth: '320px', margin: '0 auto' });

    // Create the scroll-triggered timeline
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '.how-it-works',
        start: 'top 80%',
        end: 'bottom 30%',
        scrub: 1.5,
        once: false,
      }
    });

    // Expand container
    tl.to(grid, {
      maxWidth: '100%',
      duration: 1,
      ease: 'power2.out',
    }, 0);

    // Fan out each card with stagger
    cards.forEach((card, i) => {
      tl.to(card, {
        x: 0,
        opacity: 1,
        rotateY: 0,
        rotateX: 0,
        rotateZ: 0,
        translateZ: 0,
        scale: 1,
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        duration: 1,
        ease: 'power3.out',
      }, i * 0.12);
    });

    // Why section — bounce from baseline
    const whyElements = ['.why-badge', '.why-heading', '.btn-about'];
    gsap.set(whyElements, { opacity: 0, y: 60 });
    whyElements.forEach((el, i) => {
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: 'bounce.out',
        delay: i * 0.15,
        scrollTrigger: {
          trigger: '.why-section',
          start: 'top 75%',
          toggleActions: 'play none none none',
        },
      });
    });

    // Service image cards — wipe from top + zoom
    const serviceImgCards = gsap.utils.toArray('.service-img-card');
    serviceImgCards.forEach((card) => {
      const img = card.querySelector('img');
      gsap.to(card, {
        clipPath: 'inset(0% 0 0 0)',
        duration: 1.2,
        ease: 'power3.inOut',
        scrollTrigger: {
          trigger: card,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
        onComplete: () => card.classList.add('revealed'),
      });
      gsap.to(img, {
        scale: 1,
        duration: 1.4,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: card,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
      });
    });

    // Portfolio — staggered slide-up entrance
    const portfolioCards = gsap.utils.toArray('.portfolio-card');
    gsap.set(portfolioCards, { opacity: 0, y: 40 });
    gsap.to(portfolioCards, {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: 'power2.out',
      stagger: 0.2,
      scrollTrigger: {
        trigger: '.portfolio-section',
        start: 'top 80%',
        toggleActions: 'play none none none',
      },
    });

    // Meet the team — content then media slide up
    gsap.set(['.team-teaser-content', '.team-teaser-media'], { opacity: 0, y: 50 });
    gsap.to('.team-teaser-content', {
      opacity: 1, y: 0, duration: 0.8, ease: 'power2.out',
      scrollTrigger: { trigger: '.team-teaser', start: 'top 80%', toggleActions: 'play none none none' },
    });
    gsap.to('.team-teaser-media', {
      opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', delay: 0.2,
      scrollTrigger: { trigger: '.team-teaser', start: 'top 80%', toggleActions: 'play none none none' },
    });

    // Testimonials section — fade in + slide up
    const testimonialsTop = '.testimonials-top';
    const testimonialContent = '.testimonial-content';
    gsap.set([testimonialsTop, testimonialContent], { opacity: 0, y: 50 });
    gsap.to(testimonialsTop, {
      opacity: 1, y: 0, duration: 0.8, ease: 'power2.out',
      scrollTrigger: { trigger: '.testimonials-section', start: 'top 80%', toggleActions: 'play none none none' },
    });
    gsap.to(testimonialContent, {
      opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', delay: 0.2,
      scrollTrigger: { trigger: '.testimonials-section', start: 'top 80%', toggleActions: 'play none none none' },
    });

    // Customers counter
    const customersEl = document.querySelector('.testimonials-stat-number[data-target]');
    if (customersEl) {
      const target = parseInt(customersEl.dataset.target);
      gsap.to({ val: 0 }, {
        val: target,
        duration: 2,
        ease: 'power1.out',
        scrollTrigger: { trigger: '.testimonials-section', start: 'top 80%', toggleActions: 'play none none none' },
        onUpdate: function () {
          customersEl.textContent = Math.round(this.targets()[0].val) + '+';
        }
      });
    }

    // Blogs section — header fade in + cards staggered slide up
    gsap.set('.blogs-header', { opacity: 0, y: 40 });
    gsap.to('.blogs-header', {
      opacity: 1, y: 0, duration: 0.7, ease: 'power2.out',
      scrollTrigger: { trigger: '.blogs-section', start: 'top 80%', toggleActions: 'play none none none' },
    });
    const blogCards = gsap.utils.toArray('.blog-card');
    gsap.set(blogCards, { opacity: 0, y: 40 });
    gsap.to(blogCards, {
      opacity: 1, y: 0, duration: 0.7, ease: 'power2.out', stagger: 0.15,
      scrollTrigger: { trigger: '.blogs-grid', start: 'top 85%', toggleActions: 'play none none none' },
    });

    // Testimonial slider
    let currentSlide = 0;
    const slides = document.querySelectorAll('.testimonial-slide');
    function changeTestimonial(dir) {
      slides[currentSlide].classList.add('hidden');
      currentSlide = (currentSlide + dir + slides.length) % slides.length;
      slides[currentSlide].classList.remove('hidden');
    }

    // Our Work carousel
    function scrollWork(dir) {
      const c = document.getElementById('workCarousel');
      if (!c) return;
      const card = c.querySelector('.work-card');
      const gap = parseFloat(getComputedStyle(c).columnGap || getComputedStyle(c).gap) || 20;
      const step = card ? card.offsetWidth + gap : 320;
      const max = c.scrollWidth - c.clientWidth;
      let target = c.scrollLeft + dir * step;
      if (dir > 0 && c.scrollLeft >= max - 4) target = 0;
      else if (dir < 0 && c.scrollLeft <= 4) target = max;
      c.scrollTo({ left: target, behavior: 'smooth' });
    }

  

    (function () {
      var form = document.getElementById('homeQuoteForm');
      if (!form) return;

      var rules = {
        name:           { required: true,  msg: 'Please enter your name.' },
        phone:          { required: true,  msg: 'Please enter your phone number.',
                          test: function (v) { return /^[0-9+()\s-]{6,}$/.test(v); },
                          testMsg: 'Please enter a valid phone number.' },
        service:        { required: true,  msg: 'Please choose a service.' },
        preferred_date: { required: true,  msg: 'Please choose a preferred date.' },
        email:          { required: false,
                          test: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); },
                          testMsg: 'Please enter a valid email address.' }
      };

      function fieldOf(el) { return el.closest('.form-field'); }
      function errorEl(name) { return form.querySelector('[data-error-for="' + name + '"]'); }

      function setError(name, message) {
        var el = form.elements[name];
        if (!el) return;
        var wrap = fieldOf(el), err = errorEl(name);
        if (message) {
          if (wrap) wrap.classList.add('invalid');
          if (err) err.textContent = message;
        } else {
          if (wrap) wrap.classList.remove('invalid');
          if (err) err.textContent = '';
        }
      }

      function validateField(name) {
        var el = form.elements[name];
        if (!el) return true;
        var rule = rules[name] || { required: true };
        var value = (el.value || '').trim();
        if (!value) {
          if (rule.required) { setError(name, rule.msg || 'This field is required.'); return false; }
          setError(name, ''); return true;
        }
        if (rule.test && !rule.test(value)) { setError(name, rule.testMsg || 'Please check this field.'); return false; }
        setError(name, ''); return true;
      }

      var successEl = document.getElementById('homeFormSuccess');
      var errorEl_  = document.getElementById('homeFormError');
      function showBanner(el, msg) {
        if (!el) return;
        if (msg != null) el.textContent = msg;
        el.classList.add('show');
      }
      function hideBanners() {
        if (successEl) successEl.classList.remove('show');
        if (errorEl_)  errorEl_.classList.remove('show');
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        hideBanners();

        var firstInvalid = null;
        Object.keys(rules).forEach(function (name) {
          if (!validateField(name) && !firstInvalid) firstInvalid = form.elements[name];
        });
        if (firstInvalid) { firstInvalid.focus(); return; }

        var btn = form.querySelector('[type="submit"]');
        var btnHtml = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = 'Sending…'; }

        var data = {};
        new FormData(form).forEach(function (val, key) { data[key] = val; });
        data.source = 'homepage';

        fetch(form.action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(data)
        })
          .then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok && j.ok, error: j.error }; });
          })
          .then(function (res) {
            if (res.ok) {
              showBanner(successEl);
              form.reset();
            } else {
              showBanner(errorEl_, res.error || 'Sorry, something went wrong. Please call us or try again.');
            }
          })
          .catch(function () {
            showBanner(errorEl_, 'Network error. Please try again or call us directly.');
          })
          .then(function () {
            if (btn) { btn.disabled = false; btn.innerHTML = btnHtml; }
          });
      });

      Object.keys(rules).forEach(function (name) {
        var el = form.elements[name];
        if (!el) return;
        var ev = (el.tagName === 'SELECT') ? 'change' : 'input';
        el.addEventListener(ev, function () {
          if (fieldOf(el) && fieldOf(el).classList.contains('invalid')) validateField(name);
        });
        el.addEventListener('blur', function () { validateField(name); });
      });
    })();
  
