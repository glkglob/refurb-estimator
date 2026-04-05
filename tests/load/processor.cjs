const regions = ["london", "south_east", "midlands", "north"];

function randomArea() {
  return Math.floor(Math.random() * 999) + 1;
}

function randomRegion() {
  return regions[Math.floor(Math.random() * regions.length)];
}

function buildEstimatePayload(context, events, done) {
  context.vars.area = randomArea();
  context.vars.region = randomRegion();
  return done();
}

module.exports = {
  buildEstimatePayload,
};
