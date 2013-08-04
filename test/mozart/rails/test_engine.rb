require 'minitest_helper'

class Mozart::Rails::TestEngine < MiniTest::Unit::TestCase
  def test_inherits_from_rails_engine
    # Handle all versions in one hit
    if ::Rails.version >= '3.1'
      refute_nil defined? Mozart::Rails::Engine
      assert Mozart::Rails::Engine.ancestors.include?(Rails::Engine)
    else
      assert_nil defined? Mozart::Rails::Engine
    end
  end
end
