import { test } from "node:test";
import { strict as assert } from "node:assert";
import { photoDimensions, photoThumbnailPath, photoStoragePaths, PHOTO_MAX_DIMENSION, THUMB_MAX_DIMENSION, THUMB_MAX_BYTES } from "./photo-policy";

test("display variants are limited to 800px in either orientation", () => {
  assert.deepEqual(photoDimensions(4000, 3000, THUMB_MAX_DIMENSION), { width: 800, height: 600 });
  assert.deepEqual(photoDimensions(3000, 4000, THUMB_MAX_DIMENSION), { width: 600, height: 800 });
});
test("zoom originals retain the 2400px limit", () => assert.deepEqual(photoDimensions(4000, 3000, PHOTO_MAX_DIMENSION), { width: 2400, height: 1800 }));
test("small photos are not enlarged", () => assert.deepEqual(photoDimensions(200, 150, THUMB_MAX_DIMENSION), { width: 200, height: 150 }));
test("display variant budget is 200 KB", () => assert.equal(THUMB_MAX_BYTES, 200 * 1024));
test("paired uploads map to their own thumbnail", () => assert.equal(photoThumbnailPath("job/abc/id.full.jpg"), "job/abc/id.thumb.jpg"));
test("legacy and external paths remain usable", () => {
  assert.equal(photoThumbnailPath("job/abc/old.jpg"), "job/abc/old.jpg");
  assert.equal(photoThumbnailPath("https://example.com/id.full.jpg"), "https://example.com/id.full.jpg");
});
test("photo deletion includes both variants", () => assert.deepEqual(photoStoragePaths("job/abc/id.full.jpg"), ["job/abc/id.full.jpg", "job/abc/id.thumb.jpg"]));