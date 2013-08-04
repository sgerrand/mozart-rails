require 'minitest_helper'

class Mozart::Rails::TestRailtie < MiniTest::Unit::TestCase
  def test_inherits_from_rails_railtie
    assert Mozart::Rails::Engine.ancestors.include?(Rails::Railtie)
  end
end
