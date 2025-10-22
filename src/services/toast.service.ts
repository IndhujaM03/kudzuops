import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toasts: HTMLElement[] = [];

  success(message: string): void {
    console.log('✅ Success:', message);
    this.showToast(message, 'success');
  }

  error(message: string): void {
    console.error('❌ Error:', message);
    this.showToast(message, 'error');
  }

  show(message: string, type: 'success' | 'error' = 'success'): void {
    if (type === 'success') {
      this.success(message);
    } else {
      this.error(message);
    }
  }

  private showToast(message: string, type: 'success' | 'error'): void {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">${type === 'success' ? '✅' : '❌'}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;

    // Add styles if not already added
    this.addToastStyles();

    // Add to page
    document.body.appendChild(toast);
    this.toasts.push(toast);

    // Trigger animation
    setTimeout(() => {
      toast.classList.add('toast-show');
    }, 10);

    // Auto-remove after 4 seconds (3-5 seconds range)
    setTimeout(() => {
      this.removeToast(toast);
    }, 4000);
  }

  private removeToast(toast: HTMLElement): void {
    toast.classList.add('toast-hide');
    setTimeout(() => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
      const index = this.toasts.indexOf(toast);
      if (index > -1) {
        this.toasts.splice(index, 1);
      }
    }, 300);
  }

  private addToastStyles(): void {
    if (document.getElementById('toast-styles')) return;

    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
      .toast {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        border-left: 4px solid #10b981;
        min-width: 300px;
        max-width: 500px;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease-in-out;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .toast-error {
        border-left-color: #ef4444;
      }

      .toast-show {
        opacity: 1;
        transform: translateX(0);
      }

      .toast-hide {
        opacity: 0;
        transform: translateX(100%);
      }

      .toast-content {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        gap: 12px;
      }

      .toast-icon {
        font-size: 18px;
        flex-shrink: 0;
      }

      .toast-message {
        flex: 1;
        font-size: 14px;
        font-weight: 500;
        color: #374151;
        line-height: 1.4;
      }

      .toast-close {
        background: none;
        border: none;
        font-size: 18px;
        color: #9ca3af;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: all 0.2s ease;
      }

      .toast-close:hover {
        background: #f3f4f6;
        color: #374151;
      }

      /* Success toast specific styling */
      .toast-success {
        border-left-color: #10b981;
      }

      .toast-success .toast-icon {
        color: #10b981;
      }

      /* Error toast specific styling */
      .toast-error {
        border-left-color: #ef4444;
      }

      .toast-error .toast-icon {
        color: #ef4444;
      }

      /* Stack multiple toasts */
      .toast:nth-child(n+2) {
        top: calc(20px + (n-1) * 80px);
      }
    `;
    document.head.appendChild(style);
  }
}
