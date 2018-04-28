import { Injectable } from '@angular/core';

import { BehaviorSubject } from 'rxjs';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Rx';

interface CacheContent {
  expiry: number;
  value: any;
}

@Injectable()
export class CacheService {

  private cache: Map<string, CacheContent> = new Map<string, CacheContent>();
  private inFlightObservables: Map<string, Subject<any>> = new Map<string, Subject<any>>();
  readonly DEFAULT_MAX_AGE: number = 300000;

  get(key: string, fallback?: Observable<any>, maxAge?: number): Observable<any> | Subject<any> {

    if (this.hasValidCachedValue(key)) {

      return Observable.of(this.cache.get(key).value);
    }

    if (!maxAge) {

      maxAge = this.DEFAULT_MAX_AGE;
    }

    if (this.inFlightObservables.has(key)) {

      return this.inFlightObservables.get(key);
    } else if (fallback && fallback instanceof Observable) {

      this.inFlightObservables.set(key, new Subject());

      return fallback.do((value) => { this.set(key, value, maxAge); })
        .catch(error => this.handleError(error, key));
    } else {

      return Observable.throw('Requested key is not available in Cache');
    }
  }

  set(key: string, value: any, maxAge: number = this.DEFAULT_MAX_AGE): void {

    this.cache.set(key, { value: value, expiry: Date.now() + maxAge });

    this.notifyInFlightObservers(key, value);
  }

  has(key: string): boolean {

    return this.cache.has(key);
  }

  private notifyInFlightObservers(key: string, value: any): void {

    if (this.inFlightObservables.has(key)) {

      const inFlight = this.inFlightObservables.get(key);

      const observersCount = inFlight.observers.length;

      if (observersCount) {

        inFlight.next(value);
      }

      inFlight.complete();

      this.inFlightObservables.delete(key);
    }
  }

  private hasValidCachedValue(key: string): boolean {

    if (this.cache.has(key)) {

      if (this.cache.get(key).expiry < Date.now()) {

        this.cache.delete(key);

        return false;
      }

      return true;
    } else {

      return false;
    }
  }

  private handleError(error: any, key: string): Promise<any> {
    this.notifyInFlightObservers(key, null);

    return Promise.reject(error.message || error);
  }
}
