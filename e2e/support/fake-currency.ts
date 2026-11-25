// Stand-in for the European Commission's monthly currency conversion rates, which statutory
// asks for every time a members list is saved (models/MembersList.js) to convert the members'
// fees to euro. Statutory takes the host from CONVERSION_RATE_API_HOST (config
// `conversion_rate_api.host`), which the real stack points here. Answers the one path
// statutory asks for, in the shape of the real API: a list of currencies with the country code
// statutory looks them up by (`isoA2Code`; statutory asks for the euro as `BE`) and how many of
// them make one euro (`value`).
import http from 'node:http';

import { PORTS } from './constants.ts';

const rate = (country: string, currency: string, isoA3Code: string, isoA2Code: string, value: number) => ({ country, currency, isoA3Code, isoA2Code, value, comment: null });

// Fixed rates, so the fees to AEGEE-Europe of a test are always the same.
export const CONVERSION_RATES = [
    rate('Belgium', 'Euro', 'EUR', 'BE', 1),
    rate('Switzerland', 'Swiss franc', 'CHF', 'CH', 1.25),
    rate('Poland', 'Polish zloty', 'PLN', 'PL', 4),
    rate('United Kingdom', 'Pound sterling', 'GBP', 'GB', 0.8)
];

const send = (res: http.ServerResponse, status: number, body: unknown): void => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
};

const isMain = import.meta.filename === process.argv[1];
if (isMain) {
    http.createServer((req, res) => {
        if (req.method === 'GET' && req.url === '/budg/inforeuro/api/public/monthly-rates') {
            return send(res, 200, CONVERSION_RATES);
        }

        if (req.url === '/healthcheck') {
            return send(res, 200, { success: true });
        }

        return send(res, 404, { success: false, message: 'Not found' });
    }).listen(PORTS.currency, '127.0.0.1');
}
