'use strict';

/**
 * Running the indexing procedure in whatever mode the state suggests.
 */

var Q = require('q'),
    processQuery = require('../processing/query');

const POST_PROCESSING_STEPS = [
  require('../post-processing/inherit-metadata'),
  require('../post-processing/delete-removed-assets'),
  require('../post-processing/derive-in-rotation-series')
];

module.exports = function(state) {
  var mode = require('./' + state.mode);

  state.queries = mode.generateQueries(state);

  console.log('\n=== Starting to process ===\n');

  return state.queries.reduce(function(promise, query) {
    return promise.then(function(state) {
      query.indexedAssetIds = [];
      query.assetExceptions = [];
      return processQuery(state, query);
    });
  }, new Q(state)).then(function(state) {
    console.log('\n=== Finished processing ===\n');
    return POST_PROCESSING_STEPS.reduce(Q.when, state);
  });
};
