const person = {
  name: 'John',
  arrow: () => console.log(this),
  regular() {
    console.log(this.name);
  }
};

person.arrow();
person.regular();
