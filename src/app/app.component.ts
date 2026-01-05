import { Component, signal } from '@angular/core';
import { MidniQrReaderComponent } from './components/midni-qr-reader/midni-qr-reader.component';


@Component({
  selector: 'app-root',
  imports: [MidniQrReaderComponent],
  templateUrl: './app.component.html'
})
export class App {
  protected readonly title = signal('midni-qr-reader');
}
