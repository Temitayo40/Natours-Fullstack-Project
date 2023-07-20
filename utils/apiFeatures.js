class APIFeature {
  constructor(query, queeyString) {
    this.query = query;
    this.queeyString = queeyString;
  }
  //BUILD QUERY
  //1) Filtering
  // const queryObj = { ...req.query };
  // const excludedFields = ['pages', 'sort', 'limit', 'fields'];
  // excludedFields.forEach(el => delete queryObj[el]);

  //1B) Advance Filtering
  // "\b" is used because we want to match the exact word, E.g lets take for example we have a word that have "lt" inside,
  // it will omit it and go for the exact LT.
  // "/ /g" is used because we want to select all, let say we have two or more operators, it will actully replace all of them.
  // without the "/ /g", it will only replace the first operator found
  // JSON.stringify() is used when u want to convert the object into a string.
  // JSON.parser(), thihs does this revverse of stringify by converting it back to an object

  // let queryStr = JSON.stringify(queryObj);
  // queryStr = queryStr.replace(/\b(gt|gte|lt|lte)\b/g, match => `$${match}`);

  filter() {
    const queryObj = { ...queryString };
    const excludedFields = ['pages', 'sort', 'limit', 'fields'];
    excludedFields.forEach(el => delete queryObj[el]);

    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte)\b/g, match => `$${match}`);

    this.query = this.query.find(JSON.parse(queryStr));

    return this;
    // let query = Tour.find(JSON.parse(queryStr));
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }
    return this;
  }

  limit() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }
    return this;
  }

  paginate() {
    //4) Pagination
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 100;
    const skip = (page - 1) * limit;

    //page=3&limit=10, 1-10, page 1,11-20, page 2 ...
    this.query = this.query.skip(skip).limit(limit);

    return this;
  }
}

module.exports = APIFeature;
