ENV["RAILS_ENV"] = "test"

require 'minitest_helper'

# Generators
require File.expand_path("../rails_app/config/environment.rb",  __FILE__)
require "rails/test_help"
require 'rails/generators/test_case'
