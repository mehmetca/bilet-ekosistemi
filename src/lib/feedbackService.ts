// Feedback service for audio, visual and vibration feedback

class FeedbackService {
  private audioContext: AudioContext | null = null;
  private isSupported: boolean = false;

  constructor() {
    this.checkSupport();
  }

  private checkSupport() {
    // Check Web Audio API support
    this.isSupported = typeof window !== 'undefined' && 'AudioContext' in window;
    
    // Check Vibration API support
    const vibrationSupported = typeof window !== 'undefined' && 'vibrate' in navigator;
    
    console.log('Feedback support:', {
      audio: this.isSupported,
      vibration: vibrationSupported
    });
  }

  private initAudioContext() {
    if (!this.audioContext && this.isSupported) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  // Success feedback - green beep + vibration
  async playSuccess() {
    this.initAudioContext();
    
    // Visual feedback
    this.showVisualFeedback('success');
    
    // Vibration
    if ('vibrate' in navigator) {
      navigator.vibrate([200]); // Short vibration for success
    }
    
    // Audio feedback - pleasant beep
    if (this.audioContext) {
      try {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime); // Higher pitch for success
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.3);
      } catch (error) {
        console.error('Error playing success sound:', error);
      }
    }
  }

  // Error feedback - red alert + vibration
  async playError() {
    this.initAudioContext();
    
    // Visual feedback
    this.showVisualFeedback('error');
    
    // Vibration - pattern for error
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100, 50, 200]); // Pattern for error
    }
    
    // Audio feedback - error buzz
    if (this.audioContext) {
      try {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime); // Lower pitch for error
        oscillator.type = 'sawtooth'; // Harsher sound for error
        
        gainNode.gain.setValueAtTime(0.4, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.5);
      } catch (error) {
        console.error('Error playing error sound:', error);
      }
    }
  }

  // Warning feedback - yellow alert + vibration
  async playWarning() {
    this.initAudioContext();
    
    // Visual feedback
    this.showVisualFeedback('warning');
    
    // Vibration
    if ('vibrate' in navigator) {
      navigator.vibrate([150]); // Medium vibration
    }
    
    // Audio feedback - warning tone
    if (this.audioContext) {
      try {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime); // Medium pitch
        oscillator.type = 'triangle'; // Softer sound
        
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.4);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.4);
      } catch (error) {
        console.error('Error playing warning sound:', error);
      }
    }
  }

  // Scan started feedback
  async playScanStart() {
    this.initAudioContext();
    
    // Vibration
    if ('vibrate' in navigator) {
      navigator.vibrate(50); // Very short vibration
    }
    
    // Audio feedback - scan start chirp
    if (this.audioContext) {
      try {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(1000, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, this.audioContext.currentTime + 0.1);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.1);
      } catch (error) {
        console.error('Error playing scan start sound:', error);
      }
    }
  }

  private showVisualFeedback(type: 'success' | 'error' | 'warning') {
    // Create visual feedback overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 9999;
      animation: feedbackFlash 0.3s ease-out;
    `;
    
    switch (type) {
      case 'success':
        overlay.style.backgroundColor = 'rgba(34, 197, 94, 0.3)'; // Green
        break;
      case 'error':
        overlay.style.backgroundColor = 'rgba(239, 68, 68, 0.3)'; // Red
        break;
      case 'warning':
        overlay.style.backgroundColor = 'rgba(245, 158, 11, 0.3)'; // Yellow
        break;
    }
    
    document.body.appendChild(overlay);
    
    // Remove after animation
    setTimeout(() => {
      // Idempotent remove: prevents NotFoundError when node is already detached
      // by route transitions or browser extensions mutating DOM.
      if (overlay.isConnected) {
        overlay.remove();
      }
    }, 300);
  }

  // Test all feedback types
  async testAll() {
    await this.playScanStart();
    await new Promise(resolve => setTimeout(resolve, 500));
    await this.playSuccess();
    await new Promise(resolve => setTimeout(resolve, 500));
    await this.playWarning();
    await new Promise(resolve => setTimeout(resolve, 500));
    await this.playError();
  }

  // Check if feedback is supported
  hasSupport(): boolean {
    return this.isSupported || 'vibrate' in navigator;
  }

  // Cleanup
  destroy() {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Add CSS animation for visual feedback
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes feedbackFlash {
      0% { opacity: 0; }
      50% { opacity: 1; }
      100% { opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

export const feedbackService = new FeedbackService();
