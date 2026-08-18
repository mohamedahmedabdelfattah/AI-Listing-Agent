// AI Listing Agent — IndexedDB persistence (browser-only).
// Cloned wholesale from the recorder.js idiom with a distinct DB name.
// NOT imported by the Node unit runner; covered by the fixtures/browser suite.
// Feature plan: Persistence. Design refs: §3, §8.

export const DB_NAME = 'webbrain_listings';
export const DB_VERSION = 1;

export async function saveMission(mission) { throw new Error('NotImplemented: saveMission'); }
export async function saveJob(job) { throw new Error('NotImplemented: saveJob'); }
export async function saveListing(listing) { throw new Error('NotImplemented: saveListing'); }
export async function saveListings(listings) { throw new Error('NotImplemented: saveListings'); }
export async function listListings(jobId) { throw new Error('NotImplemented: listListings'); }
export async function getJob(jobId) { throw new Error('NotImplemented: getJob'); }
export async function listJobs() { throw new Error('NotImplemented: listJobs'); }
export async function deleteJob(jobId) { throw new Error('NotImplemented: deleteJob'); }
export async function clearAll() { throw new Error('NotImplemented: clearAll'); }
