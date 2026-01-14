import {config as functionsConfig} from "firebase-functions";

export const WIKIPEDIA_URL = "https://en.wikipedia.org/wiki/The_Traitors_(British_TV_series)_series_1";

export const config = {
  storageBucket: functionsConfig().firebase.storageBucket,
};
