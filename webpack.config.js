const path = require('path');

module.exports = {
  mode: 'development',
  context: path.join(__dirname, 'src'),
  entry: {
    "test-test": './test-test.ts',
    main: './gql-lt-rails/script.ts'
  },
  output: {
    path: path.join(__dirname, 'dist'),
    libraryTarget: 'commonjs',
    filename: '[name].js',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'babel-loader',
      },
    ],
  },
  target: 'web',
  externals: /k6(\/.*)?/,
  stats: {
    colors: true,
  },
};
