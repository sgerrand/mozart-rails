require 'test_helper'
require 'generators/mozart/install/install_generator'

class InstallGeneratorTest < Rails::Generators::TestCase
  tests Mozart::Generators::InstallGenerator
  destination File.expand_path("../../tmp", File.dirname(__FILE__))

  def setup
    prepare_destination
  end

  test "Assert Mozart file is copied" do
    run_generator

    assert_file "public/javascripts/mozart.js"
  end

  test "Assert Handlebars file is copied" do
    run_generator

    assert_file "public/javascripts/handlebars.runtime.js"
  end

  test "Assert jQuery file is copied" do
    run_generator

    assert_file "public/javascripts/jquery.js"
  end

  test "Assert Underscore file is copied" do
    run_generator

    assert_file "public/javascripts/underscore.js"
  end
end
