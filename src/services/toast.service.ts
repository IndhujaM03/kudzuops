import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  
  success(message: string): void {
    console.log('✅ Success:', message);
    // You can implement actual toast notifications here
    // For now, just log to console
  }

  error(message: string): void {
    console.error('❌ Error:', message);
    // You can implement actual toast notifications here
    // For now, just log to console
  }

  show(message: string, type: 'success' | 'error' = 'success'): void {
    if (type === 'success') {
      this.success(message);
    } else {
      this.error(message);
    }
  }
}
