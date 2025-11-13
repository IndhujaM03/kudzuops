import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, ToastMessage } from '../../services/toast.service';
import { Subscription } from 'rxjs';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning';
  visible: boolean;
}

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      <div 
        *ngFor="let toast of toasts; trackBy: trackByToastId" 
        class="toast"
        [class.toast-success]="toast.type === 'success'"
        [class.toast-error]="toast.type === 'error'"
        [class.toast-warning]="toast.type === 'warning'"
        [class.toast-show]="toast.visible"
        (click)="removeToast(toast.id)"
      >
        <div class="toast-content">
          <span class="toast-icon">
            <span *ngIf="toast.type === 'success'">✅</span>
            <span *ngIf="toast.type === 'error'">❌</span>
            <span *ngIf="toast.type === 'warning'">⚠️</span>
          </span>
          <span class="toast-message">{{ toast.message }}</span>
          <button class="toast-close" (click)="removeToast(toast.id); $event.stopPropagation()">×</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
    }

    .toast {
      pointer-events: auto;
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
      cursor: pointer;
    }

    .toast-show {
      opacity: 1;
      transform: translateX(0);
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

    .toast-success {
      border-left-color: var(--kudzu-primary);
      background: rgba(236, 253, 245, 0.95);
    }

    .toast-success .toast-icon {
      color: var(--kudzu-primary);
    }

    .toast-error {
      border-left-color: #ef4444;
      background: rgba(254, 226, 226, 0.95);
    }

    .toast-error .toast-icon {
      color: #ef4444;
    }

    .toast-warning {
      border-left-color: #f59e0b;
      background: rgba(254, 243, 199, 0.95);
    }

    .toast-warning .toast-icon {
      color: #f59e0b;
    }

    .toast:nth-child(n+2) {
      top: calc(20px + (n-1) * 60px);
    }
  `]
})
export class ToastContainerComponent implements OnInit, OnDestroy {
  private toastService = inject(ToastService);
  private subscription?: Subscription;
  
  toasts: Toast[] = [];
  private toastIdCounter = 0;

  ngOnInit(): void {
    // Subscribe to toast service events
    this.subscription = this.toastService.toast$.subscribe((toastMessage: ToastMessage) => {
      this.addToast(toastMessage.message, toastMessage.type);
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  trackByToastId(index: number, toast: Toast): string {
    return toast.id;
  }

  removeToast(id: string): void {
    this.toasts = this.toasts.filter(toast => toast.id !== id);
  }

  addToast(message: string, type: 'success' | 'error' | 'warning'): void {
    const id = `toast-${++this.toastIdCounter}`;
    const toast: Toast = {
      id,
      message,
      type,
      visible: false
    };

    this.toasts.push(toast);

    // Trigger animation
    setTimeout(() => {
      toast.visible = true;
    }, 10);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      this.removeToast(id);
    }, 3000);
  }
}
