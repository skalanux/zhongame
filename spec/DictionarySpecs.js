describe("Dictionary", function() {
  it("returns a random chinese character", function() {
      characters = "Carlos";
      saludo = hola(persona);
      expected_result = "Hola "+persona+"!";
      expect(expected_result==saludo).toBe(true);
    });
});

describe("A suite", function() {
  it("contains spec with an expectation", function() {
      persona = "Carlos";
      saludo = hola(persona);
      expected_result = "Hola "+persona+"!";
      expect(expected_result==saludo).toBe(true);
    });
});


describe("A suite is just a function", function() {
  var a;

  it("and so is a spec", function() {
      a = true;

      expect(a).toBe(true);
    });
});


