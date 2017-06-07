'use strict';

const expect = require('chai').expect;
const Result = require('./../src/result.js');
const FastBootInfo = require('./../src/fastboot-info.js');
const SimpleDOM = require('simple-dom');

describe('Result', function() {
  let doc, result, html;

  beforeEach(function() {
    let req = { headers: {}, get() {} };

    doc = new SimpleDOM.Document();
    html = `<!-- EMBER_CLI_FASTBOOT_HEAD -->
            <!-- EMBER_CLI_FASTBOOT_BODY -->`;

    result = new Result({
      doc,
      html,
      fastbootInfo: new FastBootInfo(req, {}, ['example.com']),
    });
  });

  it('constructor', function() {
    expect(result).to.be.an.instanceOf(Result);
    expect(result._doc).to.be.an.instanceOf(SimpleDOM.Document);
    expect(result._html).to.be.a('string');
    expect(result._fastbootInfo).to.be.an.instanceOf(FastBootInfo);
  });

  describe('html()', function() {

    describe('reject when body insert comment missing', function () {
      beforeEach(function () {
        result._html = '<head></head><body></body>';
        result._body = '<h1>news</h2>';
      });

      it('rejects when body insert comment missing', function (done) {
        return result.html()
          .catch(function (e) {
            expect(e).to.be.an('error');
            expect(e.message).to.equal("Fastboot was not able to find <!--EMBER_CLI_FASTBOTT_BODY--> in base HTML. It could not replace the contents.");
            done();
          });
      });
    });

    describe('reject when head insert comment missing', function () {
      beforeEach(function () {
        result._html = '<head></head><body><!-- EMBER_CLI_FASTBOOT_BODY --></body>';
        result._head = '<title>news</title>';
      });

      it('rejects when head insert comment missing', function (done) {
        return result.html()
          .catch(function (e) {
            expect(e).to.be.an('error');
            expect(e.message).to.equal("Fastboot was not able to find <!--EMBER_CLI_FASTBOTT_HEAD--> in base HTML. It could not replace the contents.");
            done();
          });
      });
    });

    describe('when the response status code is 204', function () {
      beforeEach(function () {
        result._fastbootInfo.response.statusCode = 204;
        result._finalize();
      });

      it('should return an empty message body', function() {
        return result.html()
          .then(function (result) {
            expect(result).to.equal('');
          });
      });
    });

    describe('when the response status code is 3XX', function() {
      beforeEach(function() {
        result._fastbootInfo.response.headers.set('location', 'http://some.example.com/page');
        result._fastbootInfo.response.statusCode = 307;
        result._finalize();
      });

      it('should return a document body with redirect information', function() {
        return result.html()
        .then(result => {
          expect(result).to.include('<body>');
          expect(result).to.include('Redirecting to');
          expect(result).to.include('http://some.example.com/page');
          expect(result).to.include('</body>');
        });
      });
    });

    describe('when the response status code is not 3XX or 204', function() {
      let HEAD = '<meta name="foo" content="bar">';
      let BODY = '<h1>A normal response document</h1>';

      beforeEach(function() {
        doc.head.appendChild(doc.createRawHTMLSection(HEAD));
        doc.body.appendChild(doc.createRawHTMLSection(BODY));

        result._fastbootInfo.response.statusCode = 418;
        result._finalize();
      });

      it('should return the FastBoot-rendered document body', function() {
        return result.html()
        .then(result => {
          expect(result).to.include(HEAD);
          expect(result).to.include(BODY);
        });
      });
    });

    describe('when the document has special-case content', function () {
      var BODY = '<h1>A special response document: $$</h1>';

      beforeEach(function () {
        doc.body.appendChild(doc.createRawHTMLSection(BODY));

        result._fastbootInfo.response.statusCode = 418;
        result._finalize();
      });

      it('it should handle \'$$\' correctly (due to `String.replace()` gotcha)', function () {
        return result.html()
        .then(function (result) {
          expect(result).to.include(BODY);
        });
      });
    });
  });
});
