import { SERVER_ORIGIN } from "./config";

export const myFetch = (url: string, init?: Parameters<typeof fetch>[1]): ReturnType<typeof fetch> => {
    const newUrl = `${SERVER_ORIGIN}${url}`;
    console.log('myFetch:', newUrl, init);
    return fetch(newUrl, init).then(
        async (res) => {
            const clone = res.clone();
            const body = await clone.text().catch(() => '<unreadable>');
            console.log('myFetch response:', res.status, res.url, body);
            return res;
        },
        (err) => { console.log('myFetch error:', err); throw err; }
    );
};
