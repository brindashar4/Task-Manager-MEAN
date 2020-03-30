import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, empty, Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { catchError, tap, switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class WebReqInterceptor implements HttpInterceptor {

  constructor(private authService: AuthService) { }

  refreshingAccessToken: boolean;

  accessTokenRefreshed: Subject<any> = new Subject();

  //interceptors are used to append the access token with all the http requests that the user might do in the future after logging in
  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<any> {
    //handle the request
    request = this.addAuthHeader(request);

    //handle the response
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        console.log(error);        

        if(error.status === 401) {
          //refresh the access token
          return this.refreshAccessToken()
            .pipe(
              switchMap(() => {
                request = this.addAuthHeader(request);
                return next.handle(request);
              }),
              catchError((err: any) => {
                console.log(err);
                this.authService.logout();
                return empty();
              })
            )
        }

        return throwError(error);
      })
    )
  }

  refreshAccessToken() {
    if(this.refreshingAccessToken) {
      return new Observable(observer => {
        this.accessTokenRefreshed.subscribe(() => {
          //this code will run when the access has been refreshed
          observer.next();
          observer.complete();
        })
      })
    } else {
        this.refreshingAccessToken = true;
        //we want to call a method in auth service to send a request to refresh the access token
        return this.authService.getNewAccessToken().pipe(
          tap(() => {
            console.log("Access token refreshed");
            this.refreshingAccessToken = false;
            this.accessTokenRefreshed.next();
        })
      )
    }
    
  }

  addAuthHeader(request: HttpRequest<any>) {
    //get the access token
    const token = this.authService.getAccessToken();

    if(token) {
      //append the access token to the request header
      return request.clone({
        setHeaders: {
          'x-access-token': token
        }
      })
    }
    return request;
  }
}
