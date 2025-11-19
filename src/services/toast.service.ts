import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ToastMessage {
  message: string;
  type: 'success' | 'error' | 'warning';
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toasts: HTMLElement[] = [];
  private toastSubject = new Subject<ToastMessage>();
  
  // Observable for components to subscribe to
  get toast$() {
    return this.toastSubject.asObservable();
  }

  success(message: string): void {
    console.log('✅ Success:', message);
    this.showToast(message, 'success');
  }

  error(message: string): void {
    console.error('❌ Error:', message);
    this.showToast(message, 'error');
  }

  warning(message: string): void {
    console.warn('⚠️ Warning:', message);
    this.showToast(message, 'warning');
  }

  show(message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
    this.showToast(message, type);
  }

  private showToast(message: string, type: 'success' | 'error' | 'warning'): void {
    // Emit to subject for global component
    this.toastSubject.next({ message, type });
    
    // Also create direct DOM toasts for backward compatibility
    this.createDirectToast(message, type);
  }

  private createDirectToast(message: string, type: 'success' | 'error' | 'warning'): void {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Get appropriate icon for each type
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️';
    
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">${icon}</span>
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

    // Auto-remove after 3 seconds (standardized duration)
    setTimeout(() => {
      this.removeToast(toast);
    }, 3000);
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
        z-index: 1000020;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(24, 45, 23, 0.15);
        border-left: 4px solid var(--kudzu-primary);
        min-width: 280px;
        max-width: 400px;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease-in-out;
        font-family: "Manrope", "Manrope Placeholder", sans-serif;
      }

      .toast-error {
        border-left-color: #ef4444;
        background: rgba(254, 226, 226, 0.95);
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
        padding: 10px 14px;
        gap: 10px;
      }

      .toast-icon {
        font-size: 16px;
        flex-shrink: 0;
      }

      .toast-message {
        flex: 1;
        font-size: 13px;
        font-weight: 600;
        color: #1a202c;
        line-height: 1.3;
      }

      .toast-close {
        background: none;
        border: none;
        font-size: 16px;
        color: #6b7280;
        cursor: pointer;
        padding: 0;
        width: 18px;
        height: 18px;
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
        border-left-color: var(--kudzu-primary);
        background: rgba(236, 253, 245, 0.95);
      }

      .toast-success .toast-icon {
        color: var(--kudzu-primary);
      }

      /* Error toast specific styling */
      .toast-error {
        border-left-color: #ef4444;
        background: rgba(254, 226, 226, 0.95);
      }

      .toast-error .toast-icon {
        color: #ef4444;
      }

      /* Warning toast specific styling */
      .toast-warning {
        border-left-color: #f59e0b;
        background: rgba(254, 243, 199, 0.95);
      }

      .toast-warning .toast-icon {
        color: #f59e0b;
      }

      /* Stack multiple toasts */
      .toast:nth-child(n+2) {
        top: calc(20px + (n-1) * 60px);
      }
    `;
    document.head.appendChild(style);
  }
}
