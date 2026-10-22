// 输入：键盘 / 虚拟摇杆 / 画布点击 / 长按普攻
export const INPUT = {
  keys: Object.create(null),
  joy: { x: 0, y: 0, active: false },
  tap: null,
  attackHeld: false,
  handlers: {},
  _joyPointer: null,
  _base: null,
  _knob: null,

  init(canvas) {
    window.addEventListener('keydown', (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (e.repeat) {
        this.keys[k] = true;
        return;
      }
      this.keys[k] = true;
      if (k === ' ') this.attackHeld = true;
      if (k === 'j') this.attackHeld = true;
      if (['1', '2', '3', '4', '5', '6'].includes(k)) this.handlers.onSkill && this.handlers.onSkill(Number(k) - 1);
      if (k === 'Escape') this.handlers.onEscape && this.handlers.onEscape();
      if (k === 'm' && !(e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'))) {
        this.handlers.onMap && this.handlers.onMap();
      }
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys[k] = false;
      if (k === ' ' || k === 'j') this.attackHeld = false;
    });

    window.addEventListener('blur', () => {
      this.keys = Object.create(null);
      this.attackHeld = false;
    });

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      const rect = canvas.getBoundingClientRect();
      this.tap = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      this.handlers.onCanvasDown && this.handlers.onCanvasDown(this.tap.x, this.tap.y);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  bindJoystick(base, knob) {
    this._base = base;
    this._knob = knob;
    const radius = () => base.clientWidth * 0.34;

    const update = (e) => {
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const len = Math.hypot(dx, dy);
      const max = radius();
      if (len > max) {
        dx = (dx / len) * max;
        dy = (dy / len) * max;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joy.x = dx / max;
      this.joy.y = dy / max;
      this.joy.active = Math.hypot(this.joy.x, this.joy.y) > 0.16;
      if (this.joy.active) {
        this.handlers.onJoy && this.handlers.onJoy();
      }
    };

    const end = () => {
      this._joyPointer = null;
      this.joy.active = false;
      this.joy.x = 0;
      this.joy.y = 0;
      knob.style.transform = 'translate(0px, 0px)';
    };

    base.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._joyPointer = e.pointerId;
      base.setPointerCapture && base.setPointerCapture(e.pointerId);
      update(e);
    });
    base.addEventListener('pointermove', (e) => {
      if (this._joyPointer !== e.pointerId) return;
      e.preventDefault();
      update(e);
    });
    base.addEventListener('pointerup', end);
    base.addEventListener('pointercancel', end);
    base.addEventListener('lostpointercapture', end);
  },

  move() {
    let x = 0;
    let y = 0;
    if (this.keys['a'] || this.keys['ArrowLeft']) x -= 1;
    if (this.keys['d'] || this.keys['ArrowRight']) x += 1;
    if (this.keys['w'] || this.keys['ArrowUp']) y -= 1;
    if (this.keys['s'] || this.keys['ArrowDown']) y += 1;
    if (this.joy.active) {
      x += this.joy.x;
      y += this.joy.y;
    }
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return { x, y, len: Math.min(1, l) };
  },

  hasKeyboardMove() {
    return !!(
      this.keys['a'] || this.keys['d'] || this.keys['w'] || this.keys['s'] ||
      this.keys['ArrowLeft'] || this.keys['ArrowRight'] || this.keys['ArrowUp'] || this.keys['ArrowDown']
    );
  },

  consumeTap() {
    const t = this.tap;
    this.tap = null;
    return t;
  },
};
