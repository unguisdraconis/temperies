import { describe, expect, it } from 'vitest';
import styles from '../styles.css?raw';

describe('idle chrome styles', () => {
  it('fades the information panel and keeps it inert through every reset phase', () => {
    const style = document.createElement('style');
    style.textContent = styles;
    document.head.append(style);
    const shell = document.createElement('main');
    const notice = document.createElement('aside');
    notice.className = 'data-notice';
    shell.append(notice);
    document.body.append(shell);

    try {
      for (const phase of ['chrome-faded', 'reset-fading', 'resetting']) {
        shell.className = `app-shell idle-${phase}`;
        const computed = getComputedStyle(notice);
        expect(computed.opacity, phase).toBe('0');
        expect(computed.pointerEvents, phase).toBe('none');
        expect(computed.transition, phase).toContain('opacity');
      }
    } finally {
      shell.remove();
      style.remove();
    }
  });
});
