import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  private openCreateDemandSubject = new BehaviorSubject<boolean>(false);
  public openCreateDemand$ = this.openCreateDemandSubject.asObservable();

  openCreateDemand(): void {
    this.openCreateDemandSubject.next(true);
  }

  closeCreateDemand(): void {
    this.openCreateDemandSubject.next(false);
  }
}
