require 'minitest_helper'

class Mozart::Rails::TestEngine < MiniTest::Unit::TestCase
  def test_inherits_from_rails_engine
    assert Mozart::Rails::Engine.ancestors.include?(Rails::Engine)
  end
end
