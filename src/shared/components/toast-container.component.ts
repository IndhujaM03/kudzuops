import { Component } from '@angular/core';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  template: `
    <div class="toast-container">
      <!-- Toast notifications will be displayed here -->
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
    }
  `]
})
export class ToastContainerComponent {
  constructor() {}
}
