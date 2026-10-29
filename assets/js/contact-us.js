    gsap.registerPlugin(ScrollTrigger);

    gsap.fromTo('.contact-badge',
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out', delay: 0.1 }
    );
    gsap.fromTo('.contact-heading',
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out', delay: 0.2 }
    );
    gsap.fromTo('.contact-sub',
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', delay: 0.35 }
    );
    gsap.utils.toArray('.info-card').forEach(function(card, i) {
      gsap.fromTo(card,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out', delay: 0.5 + i * 0.1 }
      );
    });
    gsap.fromTo('.form-card',
      { opacity: 0, x: 40 },
      { opacity: 1, x: 0, duration: 0.9, ease: 'power2.out', delay: 0.3 }
    );

  
