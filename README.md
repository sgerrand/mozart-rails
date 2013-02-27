# Mozart::Rails

Mozart! For Rails!

This gem provides:

* Mozart 0.1.4

## Installation

Add this line to your application's Gemfile:

For Rails 3.0 apps, add the mozart-rails gem to your Gemfile.

    gem 'mozart-rails'

And then execute:

    $ bundle install

Or install it yourself via:

    $ bundle exec rake build
    $ gem install --local pkg/mozart-rails-0.0.1.gem

### Rails 3.1 or greater

The mozart files will be added to the asset pipeline and available for you to 
use. If they're not already in app/assets/javascripts/application.js by default, 
add these lines:

    //= require mozart

## Usage

TODO: Write usage instructions here

## Contributing

1. Fork it
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create new Pull Request
