/**
 * Copyright 2018 Google LLC. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as functions from 'firebase-functions';
import { playBilling, verifyAuthentication, contentManager, verifyFirebaseAuthIdToken, sendHttpsError, verifyInstanceIdToken } from '../shared'

const BASIC_PLAN_SKU = functions.config().app.basic_plan_sku;
const PREMIUM_PLAN_SKU = functions.config().app.premium_plan_sku;

/* This file contains implementation of functions related to content serving.
 * Each functions checks if the active user have access to the subscribed content,
 * and then returns the content to client app.
 */


/* Callable that serves basic content to the client
 */
export const content_basic = functions.https.onCall(async (data, context) => {
  verifyAuthentication(context);
  await verifySubscriptionOwnershipAsync(context, [BASIC_PLAN_SKU, PREMIUM_PLAN_SKU]);

  return contentManager.getBasicContent()
})

/* HTTPS request that serves basic content to the client.
 *
 * @param {Request} request
 * @param {Response} response
 */
export const content_basic_v2 = functions.https.onRequest(async (request, response) => {
  return verifyFirebaseAuthIdToken(request, response)
     .then(async (decodedToken) => {
       const uid = decodedToken.uid;
       await verifySubscriptionOwnershipAsyncV2(uid, [BASIC_PLAN_SKU, PREMIUM_PLAN_SKU]);

       const data = contentManager.getBasicContent();
       response.send(data);
     }).catch((error: functions.https.HttpsError) =>{
        sendHttpsError(error, response);
     });
});

/* Callable that serves premium content to the client
 */
export const content_premium = functions.https.onCall(async (data, context) => {
  verifyAuthentication(context);
  await verifySubscriptionOwnershipAsync(context, [PREMIUM_PLAN_SKU]);

  return contentManager.getPremiumContent()
});

/* HTTPS request that serves premium content to the client
 *
 * @param {Request} request
 * @param {Response} response
 */
export const content_premium_v2 = functions.https.onRequest(async (request, response) =>{
  return verifyFirebaseAuthIdToken(request, response)
    .then(async (decodedToken) => {
      const uid = decodedToken.uid;
      await verifySubscriptionOwnershipAsyncV2(uid, [PREMIUM_PLAN_SKU]);

      const data = contentManager.getPremiumContent();
      response.send(data);
    }).catch((error: functions.https.HttpsError) =>{
       sendHttpsError(error, response)
    });
});

/* Util function that verifies if current user owns at least one active purchases listed in skus
 */
async function verifySubscriptionOwnershipAsyncV2(uid: string, skus: Array<string>): Promise<void> {
  const purchaseList = await playBilling.users().queryCurrentSubscriptions(uid)
    .catch(err => {
      console.error(err.message);
      throw new functions.https.HttpsError('internal', 'Internal server error');
    });

  const isUserHavingTheSku = purchaseList.some(purchase => ((skus.indexOf(purchase.sku) > -1) && (purchase.isEntitlementActive())));
  if (!isUserHavingTheSku) {
    throw new functions.https.HttpsError('permission-denied', 'Valid subscription not found');
  }
}

/*Util function that verifies if current user owns at least one active purchases listed in skus
 *
 * @param {string} uid
 * @param {Array<string>} skus
 * @throws {HttpsError}
 */
async function verifySubscriptionOwnershipAsync(context: functions.https.CallableContext, skus: Array<string>): Promise<void> {
  const purchaseList = await playBilling.users().queryCurrentSubscriptions(context.auth.uid)
    .catch(err => {
      console.error(err.message);
      throw new functions.https.HttpsError('internal', 'Internal server error');
    });

  const isUserHavingTheSku = purchaseList.some(purchase => ((skus.indexOf(purchase.sku) > -1) && (purchase.isEntitlementActive())));
  if (!isUserHavingTheSku) {
    throw new functions.https.HttpsError('permission-denied', 'Valid subscription not found');
  }
}