import { SERVER_ORIGIN } from "./config";

export const myFetch = (url: string, init: Parameters<typeof fetch>[1]): ReturnType<typeof fetch> => {
    const newUrl = `${SERVER_ORIGIN}${url}`;
    console.log('myFetch:', newUrl, init);
    return fetch(newUrl, init);
};
